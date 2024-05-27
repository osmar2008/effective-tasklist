import { Fn, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'

import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate'
import { Alb } from '@cdktf/provider-aws/lib/alb'
import { AlbListener } from '@cdktf/provider-aws/lib/alb-listener'
import { AlbTargetGroup } from '@cdktf/provider-aws/lib/alb-target-group'
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group'
import { DbSubnetGroup } from '@cdktf/provider-aws/lib/db-subnet-group'
import { EcrRepository } from '@cdktf/provider-aws/lib/ecr-repository'
import { EcsCluster } from '@cdktf/provider-aws/lib/ecs-cluster'
import { EcsService } from '@cdktf/provider-aws/lib/ecs-service'
import { EcsTaskDefinition } from '@cdktf/provider-aws/lib/ecs-task-definition'
import { Eip } from '@cdktf/provider-aws/lib/eip'
import { IamInstanceProfile } from '@cdktf/provider-aws/lib/iam-instance-profile'
import { IamRole } from '@cdktf/provider-aws/lib/iam-role'
import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy'
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment'
import { Instance } from '@cdktf/provider-aws/lib/instance'
import { KmsKey } from '@cdktf/provider-aws/lib/kms-key'
import { AwsProvider } from '@cdktf/provider-aws/lib/provider'
import { RdsCluster } from '@cdktf/provider-aws/lib/rds-cluster'
import { RdsClusterInstance } from '@cdktf/provider-aws/lib/rds-cluster-instance'
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record'
import { Route53Zone } from '@cdktf/provider-aws/lib/route53-zone'
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group'
import { Vpc } from '@cdktf/provider-aws/lib/vpc'
import { VpcEndpoint } from '@cdktf/provider-aws/lib/vpc-endpoint'
import { VpcSecurityGroupEgressRule } from '@cdktf/provider-aws/lib/vpc-security-group-egress-rule'
import { VpcSecurityGroupIngressRule } from '@cdktf/provider-aws/lib/vpc-security-group-ingress-rule'
import { Password } from '@cdktf/provider-random/lib/password'
import { RandomProvider } from '@cdktf/provider-random/lib/provider'

import { DataAwsRoute53DelegationSet } from '@cdktf/provider-aws/lib/data-aws-route53-delegation-set'
import { AWS_DEFAULT_ZONE, VPC_CIDR_BLOCK, withConstruct } from './network'

export class AwsStack extends TerraformStack {
	constructor(scope: Construct, name: string) {
		super(scope, name)

		new AwsProvider(this, 'aws', {
			region: 'us-east-1',
		})

		new RandomProvider(this, 'random', {})

		const mainVpc = new Vpc(this, 'main-vpc', {
			cidrBlock: VPC_CIDR_BLOCK,
			enableDnsSupport: true,
			enableDnsHostnames: true,
			tags: {
				Name: 'main-vpc',
			},
		})

		const { buildNetworkStack } = withConstruct(this)

		const { privateSubnet1a, privateSubnet1b, publicSubnet1a, publicSubnet1b } = buildNetworkStack(mainVpc)

		const privateSubnetsIds = [privateSubnet1a.id, privateSubnet1b.id]
		const publicSubnetsIds = [publicSubnet1a.id, publicSubnet1b.id]

		const delegationSet = new DataAwsRoute53DelegationSet(this, 'dset', {
			id: 'N06858323K8FO7AN20DBY',
		})

		const hostedZone = new Route53Zone(this, 'route-53-hosted-zone', {
			delegationSetId: delegationSet.id,
			name: 'effectivedev.blog',
		})

		const certificate = new AcmCertificate(this, 'acm-certificate', {
			domainName: 'tasklist.effectivedev.blog',
			validationMethod: 'DNS',
		})

		new Route53Record(this, 'acm-certificate-validation-record', {
			zoneId: hostedZone.zoneId,
			name: certificate.domainValidationOptions.get(0).resourceRecordName,
			type: certificate.domainValidationOptions.get(0).resourceRecordType,
			records: [certificate.domainValidationOptions.get(0).resourceRecordValue],
			ttl: 60,
		})

		const dbSubnetGroup = new DbSubnetGroup(this, 'subnet-group-db', {
			name: 'subnet-group-db',
			subnetIds: privateSubnetsIds,
		})

		const dbSecurityGroup = new SecurityGroup(this, 'security-group-db', {
			vpcId: mainVpc.id,
			name: 'security-group-db',
			description: 'Security group for the database',
		})

		const jumpboxIamRole = new IamRole(this, 'jumpbox-iam-role', {
			assumeRolePolicy: JSON.stringify({
				Version: '2012-10-17',
				Statement: [
					{
						Action: 'sts:AssumeRole',
						Principal: { Service: 'ec2.amazonaws.com' },
						Effect: 'Allow',
					},
				],
			}),
		})

		new IamRolePolicy(this, 'jumpbox-iam-role-policy', {
			role: jumpboxIamRole.id,
			policy: JSON.stringify({
				Version: '2012-10-17',
				Statement: [
					{
						Action: [
							'ssm:DescribeAssociation',
							'ssm:GetDeployablePatchSnapshotForInstance',
							'ssm:GetDocument',
							'ssm:DescribeDocument',
							'ssm:GetManifest',
							'ssm:GetParameter',
							'ssm:GetParameters',
							'ssm:ListAssociations',
							'ssm:ListInstanceAssociations',
							'ssm:PutInventory',
							'ssm:PutComplianceItems',
							'ssm:PutConfigurePackageResult',
							'ssm:UpdateAssociationStatus',
							'ssm:UpdateInstanceAssociationStatus',
							'ssm:UpdateInstanceInformation',
						],
						Effect: 'Allow',
						Resource: '*',
					},
				],
			}),
		})

		// Create an instance profile and add the role to it
		const instanceProfile = new IamInstanceProfile(this, 'InstanceProfile', {
			role: jumpboxIamRole.name,
		})

		// Create a security group for the instance
		const jumpboxSecurityGroup = new SecurityGroup(this, 'SecurityGroup', {
			vpcId: mainVpc.id,
			ingress: [
				{
					description: 'Allow SSH from anywhere',
					fromPort: 22,
					toPort: 22,
					protocol: 'tcp',
					cidrBlocks: ['0.0.0.0/0'],
				},
			],
			egress: [
				{
					description: 'Allow all outbound traffic',
					fromPort: 0,
					toPort: 0,
					protocol: '-1',
					cidrBlocks: ['0.0.0.0/0'],
				},
			],
		})

		const jumpBox = new Instance(this, 'ec2-instance-jumpbox', {
			ami: 'ami-080e1f13689e07408', // Ubuntu 22.04
			instanceType: 't2.micro',
			vpcSecurityGroupIds: [jumpboxSecurityGroup.id],
			iamInstanceProfile: instanceProfile.name,
			subnetId: publicSubnet1a.id,
		})

		const jumpBoxEip = new Eip(this, 'eip-jumpbox', {
			domain: 'vpc',
			instance: jumpBox.id,
		})

		new VpcSecurityGroupIngressRule(this, 'ingress-rule-jumpbox', {
			securityGroupId: jumpboxSecurityGroup.id,
			ipProtocol: 'tcp',
			fromPort: 443,
			toPort: 443,
			cidrIpv4: '0.0.0.0/0',
		})

		new VpcSecurityGroupEgressRule(this, 'egress-rule-jumpbox', {
			securityGroupId: jumpboxSecurityGroup.id,
			ipProtocol: 'tcp',
			fromPort: 22,
			toPort: 22,
			cidrIpv4: publicSubnet1a.cidrBlock,
		})

		new VpcSecurityGroupIngressRule(this, 'private-subnet-1a-ingress-rule-db', {
			securityGroupId: dbSecurityGroup.id,
			ipProtocol: 'tcp',
			fromPort: 5432,
			toPort: 5432,
			cidrIpv4: privateSubnet1a.cidrBlock,
		})

		new VpcSecurityGroupEgressRule(this, 'private-subnet-1a-egress-rule-db', {
			securityGroupId: dbSecurityGroup.id,
			ipProtocol: 'tcp',
			fromPort: 5432,
			toPort: 5432,
			cidrIpv4: privateSubnet1a.cidrBlock,
		})

		new VpcSecurityGroupIngressRule(this, 'private-subnet-1b-ingress-rule-db', {
			securityGroupId: dbSecurityGroup.id,
			ipProtocol: 'tcp',
			fromPort: 5432,
			toPort: 5432,
			cidrIpv4: privateSubnet1b.cidrBlock,
		})

		new VpcSecurityGroupEgressRule(this, 'private-subnet-1b-egress-rule-db', {
			securityGroupId: dbSecurityGroup.id,
			ipProtocol: 'tcp',
			fromPort: 5432,
			toPort: 5432,
			cidrIpv4: privateSubnet1b.cidrBlock,
		})

		new VpcSecurityGroupIngressRule(this, 'db-vpc-ingress-rule-jumpbox', {
			securityGroupId: dbSecurityGroup.id,
			ipProtocol: 'tcp',
			fromPort: 5432,
			toPort: 5432,
			cidrIpv4: `${jumpBox.privateIp}/32`,
		})

		new VpcSecurityGroupEgressRule(this, 'db-vpc-egress-rule-jumpbox', {
			securityGroupId: dbSecurityGroup.id,
			ipProtocol: 'tcp',
			fromPort: 5432,
			toPort: 5432,
			cidrIpv4: `${jumpBoxEip.privateIp}/32`,
		})

		const dbUsername = new Password(this, 'username-db', {
			length: 10,
			overrideSpecial: '!#$%&*()-_=+[]{}<>:?',
			special: false,
		})

		const dbKmsKey = new KmsKey(this, 'example', {
			description: 'Database Key',
		})

		const auroraCluster = new RdsCluster(this, 'aurora-cluster', {
			engine: 'aurora-postgresql',
			clusterIdentifier: 'aurora-cluster-tasklist',
			masterUsername: dbUsername.result,
			databaseName: 'tasklist',
			manageMasterUserPassword: true,
			dbSubnetGroupName: dbSubnetGroup.name,
			masterUserSecretKmsKeyId: dbKmsKey.keyId,
			skipFinalSnapshot: true,
			storageEncrypted: true,
			vpcSecurityGroupIds: [dbSecurityGroup.id],
		})

		new RdsClusterInstance(this, 'rds-cluster-instance', {
			identifier: 'aurora-cluster-demo-instance',
			clusterIdentifier: auroraCluster.id,
			instanceClass: 'db.t3.medium',
			engine: 'aurora-postgresql',
		})

		const ecrRepo = new EcrRepository(this, 'ecr-repo', {
			name: 'ecr-repo',
			forceDelete: true,
		})

		const ecsCluster = new EcsCluster(this, 'ecs-cluster', {
			name: 'ecs-cluster',
		})

		const albSecurityGroup = new SecurityGroup(this, 'nginx-security-group', {
			vpcId: mainVpc.id,
			name: 'nginx-security-group',
			description: 'Security group for Nginx on Fargate',
			ingress: [
				{
					description: 'Allow inbound HTTP',
					fromPort: 80,
					toPort: 80,
					protocol: 'tcp',
					cidrBlocks: ['0.0.0.0/0'],
				},
				{
					description: 'Allow inbound HTTPS',
					fromPort: 443,
					toPort: 443,
					protocol: 'tcp',
					cidrBlocks: ['0.0.0.0/0'],
				},
			],
			egress: [
				{
					description: 'Allow all outbound',
					fromPort: 0,
					toPort: 0,
					protocol: '-1',
					cidrBlocks: ['0.0.0.0/0'],
				},
			],
		})

		const publicSubnetsAlb = new Alb(this, 'public-subnets-alb', {
			name: 'public-subnets-alb',
			internal: false,
			loadBalancerType: 'application',
			securityGroups: [albSecurityGroup.id],
			subnets: publicSubnetsIds,
		})

		new Route53Record(this, 'alias', {
			name: 'tasklist.effectivedev.blog',
			type: 'A',
			zoneId: hostedZone.id,
			alias: {
				name: publicSubnetsAlb.dnsName,
				zoneId: publicSubnetsAlb.zoneId,
				evaluateTargetHealth: true,
			},
		})

		const publicSubnetAlbTargetGroup = new AlbTargetGroup(this, 'public-subnets-alb-target-group', {
			name: 'public-subnets-alb-target-group',
			port: 8080,
			protocol: 'HTTP',
			vpcId: mainVpc.id,
			targetType: 'ip',
		})

		new AlbListener(this, 'public-subnets-alb-listener-80', {
			loadBalancerArn: publicSubnetsAlb.arn,
			port: 80,
			protocol: 'HTTP',
			defaultAction: [
				{
					redirect: {
						port: '443',
						protocol: 'HTTPS',
						statusCode: 'HTTP_301',
					},
					type: 'redirect',
				},
			],
		})

		new AlbListener(this, 'public-subnets-alb-listener-443', {
			loadBalancerArn: publicSubnetsAlb.arn,
			port: 443,
			protocol: 'HTTPS',
			sslPolicy: 'ELBSecurityPolicy-2016-08',
			certificateArn: certificate.arn,
			defaultAction: [
				{
					type: 'forward',
					targetGroupArn: publicSubnetAlbTargetGroup.arn,
				},
			],
		})

		const cloudWatchLogGroupNginx = new CloudwatchLogGroup(this, 'nginx-cloudwatch-log-group', {
			namePrefix: 'nginx',
			retentionInDays: 14,
		})

		const containerDefinitions = {
			name: 'nginx',
			image: `${ecrRepo.repositoryUrl}:${process.env.ECS_IMAGE_TAG}`,
			essential: true,
			cpu: 0,
			environment: [],
			mountPoints: [],
			systemControls: [],
			volumesFrom: [],
			portMappings: [
				{
					containerPort: 8080,
					hostPort: 8080,
					protocol: 'tcp',
				},
			],
			healthCheck: {
				command: ['CMD-SHELL', 'curl -f http://localhost:8080/ || exit 1'],
				interval: 30,
				retries: 3,
				startPeriod: 5,
				timeout: 5,
			},
			logConfiguration: {
				logDriver: 'awslogs',
				options: {
					'awslogs-group': cloudWatchLogGroupNginx.name,
					'awslogs-region': AWS_DEFAULT_ZONE,
					'awslogs-stream-prefix': cloudWatchLogGroupNginx.namePrefix,
				},
			},
		}

		const vpcEndpointSecurityGroup = new SecurityGroup(this, 'vpc-endpoint-security-group', {
			vpcId: mainVpc.id,
			name: 'vpc-endpoint-security-group',
			description: 'Security group for VPC Endpoints',
			ingress: [
				{
					description: 'Allow inbound HTTP',
					fromPort: 0,
					toPort: 0,
					protocol: '-1',
					cidrBlocks: ['0.0.0.0/0'],
				},
			],
			egress: [
				{
					description: 'Allow all outbound',
					fromPort: 0,
					toPort: 0,
					protocol: '-1',
					cidrBlocks: ['0.0.0.0/0'],
				},
			],
		})

		const ecsSecurityGroup = new SecurityGroup(this, 'ecs-security-group', {
			vpcId: mainVpc.id,
			name: 'ecs-security-group',
			description: 'Security group for VPC Endpoints',
			ingress: [
				{
					description: 'Allow inbound HTTP',
					fromPort: 8080,
					toPort: 8080,
					protocol: 'tcp',
					cidrBlocks: ['0.0.0.0/0'],
				},
			],
			egress: [
				{
					description: 'Allow all outbound',
					fromPort: 0,
					toPort: 0,
					protocol: '-1',
					cidrBlocks: ['0.0.0.0/0'],
				},
			],
		})

		new VpcEndpoint(this, 'vpc-endpoint-ecr-dkr', {
			vpcId: mainVpc.id,
			vpcEndpointType: 'Interface',
			serviceName: 'com.amazonaws.us-east-1.ecr.dkr',
			privateDnsEnabled: true,
			subnetIds: privateSubnetsIds,
			securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
		})

		new VpcEndpoint(this, 'vpc-endpoint-ecr-api', {
			vpcId: mainVpc.id,
			vpcEndpointType: 'Interface',
			serviceName: 'com.amazonaws.us-east-1.ecr.api',
			privateDnsEnabled: true,
			subnetIds: privateSubnetsIds,
			securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
		})

		new VpcEndpoint(this, 'vpc-endpoint-s3', {
			vpcId: mainVpc.id,
			vpcEndpointType: 'Gateway',
			serviceName: 'com.amazonaws.us-east-1.s3',
		})

		new VpcEndpoint(this, 'vpc-endpoint-secrets-manager', {
			vpcId: mainVpc.id,
			vpcEndpointType: 'Interface',
			serviceName: 'com.amazonaws.us-east-1.secretsmanager',
			privateDnsEnabled: true,
			subnetIds: privateSubnetsIds,
			securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
		})

		new VpcEndpoint(this, 'vpc-endpoint-cloudwatch', {
			vpcId: mainVpc.id,
			vpcEndpointType: 'Interface',
			serviceName: 'com.amazonaws.us-east-1.logs',
			privateDnsEnabled: true,
			subnetIds: privateSubnetsIds,
			securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
		})

		const ecsExecutionTaskRole = new IamRole(this, 'ecs-execution-task-role', {
			name: 'ecs-execution-task-role',
			assumeRolePolicy: Fn.jsonencode({
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: 'sts:AssumeRole',
						Principal: {
							Service: 'ecs-tasks.amazonaws.com',
						},
					},
				],
			}),
		})

		const ecsTaskRole = new IamRole(this, 'ecs-task-role', {
			name: 'ecs-task-role',
			assumeRolePolicy: Fn.jsonencode({
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: 'sts:AssumeRole',
						Principal: {
							Service: 'ecs-tasks.amazonaws.com',
						},
					},
				],
			}),
		})

		new IamRolePolicy(this, 'ecs-task-role-policy', {
			name: 'ecs-task-role-policy',
			role: ecsTaskRole.id,
			policy: Fn.jsonencode({
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: ['ecr:GetAuthorizationToken', 'logs:CreateLogStream', 'logs:PutLogEvents'],
						Resource: '*',
					},
					{
						Effect: 'Allow',
						Action: ['ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'],
						Resource: '*',
					},
				],
			}),
		})

		new IamRolePolicyAttachment(this, 'ecs-task-role-policy-attachment', {
			role: ecsExecutionTaskRole.name,
			policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
		})

		const taskDefinition = new EcsTaskDefinition(this, 'ecs-task-definition', {
			taskRoleArn: ecsTaskRole.arn,
			family: 'nginx-task',
			cpu: '256',
			memory: '512',
			networkMode: 'awsvpc',
			requiresCompatibilities: ['FARGATE'],
			executionRoleArn: ecsTaskRole.arn,
			containerDefinitions: Fn.jsonencode([containerDefinitions]),
		})

		new EcsService(this, 'ecs-service', {
			name: 'ecs-service',
			cluster: ecsCluster.id,
			taskDefinition: taskDefinition.arn,
			desiredCount: 1,
			launchType: 'FARGATE',
			networkConfiguration: {
				subnets: privateSubnetsIds,
				securityGroups: [ecsSecurityGroup.id, albSecurityGroup.id, vpcEndpointSecurityGroup.id],
			},
			deploymentMaximumPercent: 200,
			deploymentMinimumHealthyPercent: 50,
			deploymentCircuitBreaker: {
				enable: true,
				rollback: true,
			},
			loadBalancer: [
				{
					targetGroupArn: publicSubnetAlbTargetGroup.arn,
					containerName: containerDefinitions.name,
					containerPort: 8080,
				},
			],
		})
	}
}
