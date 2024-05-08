import { Fn, TerraformStack } from "cdktf";
import { Construct } from "constructs";

import { AcmCertificate } from "@cdktf/provider-aws/lib/acm-certificate";
import { Alb } from "@cdktf/provider-aws/lib/alb";
import { AlbListener } from "@cdktf/provider-aws/lib/alb-listener";
import { AlbTargetGroup } from "@cdktf/provider-aws/lib/alb-target-group";
import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch-log-group";
import { DbSubnetGroup } from "@cdktf/provider-aws/lib/db-subnet-group";
import { EcrRepository } from "@cdktf/provider-aws/lib/ecr-repository";
import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition";
import { Eip } from "@cdktf/provider-aws/lib/eip";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { Instance } from "@cdktf/provider-aws/lib/instance";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { KmsKey } from "@cdktf/provider-aws/lib/kms-key";
import { NatGateway } from "@cdktf/provider-aws/lib/nat-gateway";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { RdsCluster } from "@cdktf/provider-aws/lib/rds-cluster";
import { RdsClusterInstance } from "@cdktf/provider-aws/lib/rds-cluster-instance";
import { Route } from "@cdktf/provider-aws/lib/route";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";
import { Route53Record } from "@cdktf/provider-aws/lib/route53-record";
import { Route53Zone } from "@cdktf/provider-aws/lib/route53-zone";
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { VpcEndpoint } from "@cdktf/provider-aws/lib/vpc-endpoint";
import { VpcSecurityGroupEgressRule } from "@cdktf/provider-aws/lib/vpc-security-group-egress-rule";
import { VpcSecurityGroupIngressRule } from "@cdktf/provider-aws/lib/vpc-security-group-ingress-rule";
import { Password } from "@cdktf/provider-random/lib/password";
import { RandomProvider } from "@cdktf/provider-random/lib/provider";

import { CloudwatchEventRule } from "@cdktf/provider-aws/lib/cloudwatch-event-rule";
import { CloudwatchEventTarget } from "@cdktf/provider-aws/lib/cloudwatch-event-target";
import { IamRolePolicy } from "@cdktf/provider-aws/lib/iam-role-policy";
import { withConstruct } from "./network";

export class AwsStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, "aws", {
      region: "us-east-1",
    });

    new RandomProvider(this, "random", {});

    const networkStack = withConstruct(this);

    const { vpc } = networkStack.setupVPC();

    const {
      privateSubnet1,
      privateSubnet2,
      publicSubnet1,
      publicSubnet2,
      eip,
    } = networkStack.getNetworkStackBuilder(vpc);

    const hostedZone = new Route53Zone(this, "HostedZone", {
      name: "effectivedev.blog.", // replace with your domain name
      comment: "Managed by Terraform CDK",
    });

    const certificate = new AcmCertificate(this, "Certificate", {
      domainName: "tasklist.effectivedev.blog",
      validationMethod: "DNS",
    });

    new Route53Record(this, "CertificateValidationRecord", {
      zoneId: hostedZone.zoneId,
      name: certificate.domainValidationOptions.get(0).resourceRecordName,
      type: certificate.domainValidationOptions.get(0).resourceRecordType,
      records: [certificate.domainValidationOptions.get(0).resourceRecordValue],
      ttl: 60,
    });

    const dbSubnetGroup = new DbSubnetGroup(this, "DbSubnetGroup", {
      name: "db-subnet-group",
      subnetIds: [privateSubnet1.id, privateSubnet2.id],
    });

    const dbSecurityGroup = new SecurityGroup(this, "SecurityGroup", {
      vpcId: vpc.id,
      name: "db_security_group",
      description: "Security group for the database",
    });

    const jumpBoxSecurityGroup = new SecurityGroup(
      this,
      "jumpBoxSecurityGroup",
      {
        vpcId: vpc.id,
        name: "jump-box-sg",
        description: "Security group for Jump Box",
      }
    );

    const jumpBox = new Instance(this, "jumpBox", {
      ami: "ami-080e1f13689e07408", // Ubuntu 22.04
      instanceType: "t2.micro",
      subnetId: publicSubnet1.id,
      keyName: "MyKeyPair",
      vpcSecurityGroupIds: [jumpBoxSecurityGroup.id],
    });

    const jumpBoxEip = new Eip(this, "JumpBoxEip", {
      domain: "vpc",
      instance: jumpBox.id,
    });

    new VpcSecurityGroupIngressRule(this, "JumpBoxIngressRule", {
      securityGroupId: jumpBoxSecurityGroup.id,
      ipProtocol: "tcp",
      fromPort: 22,
      toPort: 22,
      cidrIpv4: "0.0.0.0/0",
    });

    new VpcSecurityGroupEgressRule(this, "JumpBoxEgressRule", {
      securityGroupId: jumpBoxSecurityGroup.id,
      ipProtocol: "tcp",
      fromPort: 0,
      toPort: 0,
      cidrIpv4: "0.0.0.0/0",
    });

    new VpcSecurityGroupIngressRule(this, "DbPrivateSubnet1IngressRule", {
      securityGroupId: dbSecurityGroup.id,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      cidrIpv4: privateSubnet1.cidrBlock,
    });

    new VpcSecurityGroupEgressRule(this, "DbPrivateSubnet1EgressRule", {
      securityGroupId: dbSecurityGroup.id,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      cidrIpv4: privateSubnet1.cidrBlock,
    });

    new VpcSecurityGroupIngressRule(this, "DbJumpboxIngressRule", {
      securityGroupId: dbSecurityGroup.id,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      cidrIpv4: `${jumpBox.privateIp}/32`,
    });

    new VpcSecurityGroupEgressRule(this, "DbJumpboxEgressRule", {
      securityGroupId: dbSecurityGroup.id,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      cidrIpv4: `${jumpBoxEip.privateIp}/32`,
    });

    const dbUsername = new Password(this, "dbUsername", {
      length: 10,
      overrideSpecial: "!#$%&*()-_=+[]{}<>:?",
      special: false,
    });

    const dbKmsKey = new KmsKey(this, "example", {
      description: "Database Key",
    });

    const auroraCluster = new RdsCluster(this, "AuroraCluster", {
      engine: "aurora-postgresql",
      clusterIdentifier: "aurora-cluster-demo",
      masterUsername: dbUsername.result,
      databaseName: "mydb",
      manageMasterUserPassword: true,
      dbSubnetGroupName: dbSubnetGroup.name,
      masterUserSecretKmsKeyId: dbKmsKey.keyId,
      skipFinalSnapshot: true,
      storageEncrypted: true,
      vpcSecurityGroupIds: [dbSecurityGroup.id],
    });

    new RdsClusterInstance(this, "AuroraClusterInstance", {
      identifier: "aurora-cluster-demo-instance",
      clusterIdentifier: auroraCluster.id,
      instanceClass: "db.t3.medium",
      engine: "aurora-postgresql",
    });

    const internetGateway = new InternetGateway(this, "InternetGateway", {
      vpcId: vpc.id,
    });

    const natGateway = new NatGateway(this, "NatGateway", {
      allocationId: eip.id,
      subnetId: publicSubnet1.id, // Assuming subnet1 is a public subnet
    });

    const publicRouteTable = new RouteTable(this, "PublicRouteTable", {
      vpcId: vpc.id,
    });

    // Create a route for Internet Gateway
    new Route(this, "InternetRoute", {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    });

    // Associate the public subnet with the new Route Table
    new RouteTableAssociation(this, "PublicSubnet1Association", {
      subnetId: publicSubnet1.id,
      routeTableId: publicRouteTable.id,
    });

    new RouteTableAssociation(this, "PublicSubne2tAssociation", {
      subnetId: publicSubnet2.id,
      routeTableId: publicRouteTable.id,
    });

    const privateRouteTable = new RouteTable(this, "PrivateRouteTable", {
      vpcId: vpc.id,
    });

    new Route(this, "NatRoute", {
      routeTableId: privateRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway.id,
    });

    new RouteTableAssociation(this, "PrivateSubnet1Association", {
      subnetId: privateSubnet1.id,
      routeTableId: privateRouteTable.id,
    });

    new RouteTableAssociation(this, "PrivateSubne2Association", {
      subnetId: privateSubnet2.id,
      routeTableId: privateRouteTable.id,
    });

    const ecrRepo = new EcrRepository(this, "EcrRepo", {
      name: "my-ecr-repo",
      forceDelete: true,
    });

    const ecsCluster = new EcsCluster(this, "ecsCluster", {
      name: "my-cluster",
    });

    const albSecurityGroup = new SecurityGroup(this, "securityGroup", {
      vpcId: vpc.id,
      name: "nginx-sg",
      description: "Security group for Nginx on Fargate",
      ingress: [
        {
          description: "Allow inbound HTTP",
          fromPort: 80,
          toPort: 80,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
        {
          description: "Allow inbound HTTPS",
          fromPort: 443,
          toPort: 443,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      egress: [
        {
          description: "Allow all outbound",
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    const alb = new Alb(this, "Alb", {
      name: "my-alb",
      internal: false,
      loadBalancerType: "application",
      securityGroups: [albSecurityGroup.id],
      subnets: [publicSubnet1.id, publicSubnet2.id],
    });

    new Route53Record(this, "alias", {
      name: "tasklist.effectivedev.blog",
      type: "A",
      zoneId: hostedZone.id,
      alias: {
        name: alb.dnsName,
        zoneId: alb.zoneId,
        evaluateTargetHealth: true,
      },
    });

    const targetGroup = new AlbTargetGroup(this, "AlbTargetGroup", {
      name: "my-target-group",
      port: 8080,
      protocol: "HTTP",
      vpcId: vpc.id,
      targetType: "ip",
    });

    new AlbListener(this, "AlbListener", {
      loadBalancerArn: alb.arn,
      port: 80,
      protocol: "HTTP",
      defaultAction: [
        {
          redirect: {
            port: "443",
            protocol: "HTTPS",
            statusCode: "HTTP_301",
          },
          type: "redirect",
        },
      ],
    });

    new AlbListener(this, "HttpsAlbListener", {
      loadBalancerArn: alb.arn,
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-2016-08",
      certificateArn: certificate.arn,
      defaultAction: [
        {
          type: "forward",
          targetGroupArn: targetGroup.arn,
        },
      ],
    });

    const containerDefinitions = {
      name: "nginx",
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
          protocol: "tcp",
        },
      ],
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:8080/ || exit 1"],
        interval: 30,
        retries: 3,
        startPeriod: 5,
        timeout: 5,
      },
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": "/ecs/my-log-group",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs",
        },
      },
    };

    new CloudwatchLogGroup(this, "LogGroup", {
      name: "/ecs/my-log-group",
      retentionInDays: 14,
    });

    const logGroup = new CloudwatchLogGroup(this, "EventLogGroup", {
      name: "/ecs/event-log-group",
    });

    const eventRule = new CloudwatchEventRule(this, "EventRule", {
      name: "my-event-rule",
      eventPattern: JSON.stringify({
        source: ["aws.ecs"],
        "detail-type": ["ECS Task State Change", "ECS Service Action"],
      }),
    });

    new CloudwatchEventTarget(this, "EventTarget", {
      rule: eventRule.name,
      arn: logGroup.arn,
    });

    const vpcEndpointSecurityGroup = new SecurityGroup(
      this,
      "vpcEndpointSecurityGroup",
      {
        vpcId: vpc.id,
        name: "vpce-sg",
        description: "Security group for VPC Endpoints",
        ingress: [
          {
            description: "Allow inbound HTTP",
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: ["0.0.0.0/0"],
          },
        ],
        egress: [
          {
            description: "Allow all outbound",
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: ["0.0.0.0/0"],
          },
        ],
      }
    );

    const ecsSecurityGroup = new SecurityGroup(this, "ecsSecurityGroup", {
      vpcId: vpc.id,
      name: "ecs-sg",
      description: "Security group for VPC Endpoints",
      ingress: [
        {
          description: "Allow inbound HTTP",
          fromPort: 8080,
          toPort: 8080,
          protocol: "tcp",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
      egress: [
        {
          description: "Allow all outbound",
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
        },
      ],
    });

    new VpcEndpoint(this, "VpcEndpointEcrDkr", {
      vpcId: vpc.id,
      vpcEndpointType: "Interface",
      serviceName: "com.amazonaws.us-east-1.ecr.dkr",
      privateDnsEnabled: true,
      securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
    });

    const vpcEndpointEcrApi = new VpcEndpoint(this, "VpcEndpointEcrApi", {
      vpcId: vpc.id,
      vpcEndpointType: "Interface",
      serviceName: "com.amazonaws.us-east-1.ecr.api",
      privateDnsEnabled: true,
      subnetIds: [privateSubnet1.id, privateSubnet2.id],
      securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
    });

    new VpcEndpoint(this, "VpcEndpointS3", {
      vpcId: vpc.id,
      vpcEndpointType: "Gateway",
      serviceName: "com.amazonaws.us-east-1.s3",
    });

    new VpcEndpoint(this, "VpcEndpointSecretsManager", {
      vpcId: vpc.id,
      vpcEndpointType: "Interface",
      serviceName: "com.amazonaws.us-east-1.secretsmanager",
      privateDnsEnabled: true,
      subnetIds: [privateSubnet1.id, privateSubnet2.id],
      securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
    });

    new VpcEndpoint(this, "VpcEndpointCloudWatch", {
      vpcId: vpc.id,
      vpcEndpointType: "Interface",
      serviceName: "com.amazonaws.us-east-1.logs",
      privateDnsEnabled: true,
      subnetIds: [privateSubnet1.id, privateSubnet2.id],
      securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
    });

    const executionTaskRole = new IamRole(this, "executionTaskRole", {
      name: "executionTaskRole",
      assumeRolePolicy: Fn.jsonencode({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: "sts:AssumeRole",
            Principal: {
              Service: "ecs-tasks.amazonaws.com",
            },
          },
        ],
      }),
    });

    const ecsTaskRole = new IamRole(this, "ecsTaskRole", {
      name: "ecsTaskRole",
      assumeRolePolicy: Fn.jsonencode({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: "sts:AssumeRole",
            Principal: {
              Service: "ecs-tasks.amazonaws.com",
            },
          },
        ],
      }),
    });

    new IamRolePolicy(this, "ecsTaskRolePolicy", {
      name: "ecsTaskRolePolicy",
      role: ecsTaskRole.id,
      policy: Fn.jsonencode({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "ecr:GetAuthorizationToken",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
            ],
            Resource: "*",
          },
          {
            Effect: "Allow",
            Action: [
              "ecr:BatchCheckLayerAvailability",
              "ecr:GetDownloadUrlForLayer",
              "ecr:BatchGetImage",
            ],
            Resource: "*",
            Condition: {
              StringEquals: {
                "aws:sourceVpce": vpcEndpointEcrApi.id,
                "aws:sourceVpc": vpc.id,
              },
            },
          },
        ],
      }),
    });

    new IamRolePolicyAttachment(this, "taskRolePolicyAttachment", {
      role: executionTaskRole.name,
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    const taskDefinition = new EcsTaskDefinition(this, "taskDefinition", {
      taskRoleArn: ecsTaskRole.arn,
      family: "nginx-task",
      cpu: "256",
      memory: "512",
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      executionRoleArn: ecsTaskRole.arn,
      containerDefinitions: Fn.jsonencode([containerDefinitions]),
    });

    new EcsService(this, "ecsService", {
      name: "ecs-example-service",
      cluster: ecsCluster.id,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: [privateSubnet1.id, privateSubnet2.id],
        assignPublicIp: true,
        securityGroups: [
          ecsSecurityGroup.id,
          albSecurityGroup.id,
          vpcEndpointSecurityGroup.id,
        ],
      },
      deploymentMaximumPercent: 200,
      deploymentMinimumHealthyPercent: 50,
      deploymentCircuitBreaker: {
        enable: true,
        rollback: true,
      },
      loadBalancer: [
        {
          targetGroupArn: targetGroup.arn,
          containerName: "nginx",
          containerPort: 8080,
        },
      ],
    });
  }
}
