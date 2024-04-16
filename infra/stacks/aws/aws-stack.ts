import { Fn, TerraformOutput, TerraformStack } from "cdktf";
import { Construct } from "constructs";

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
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { Vpc } from "@cdktf/provider-aws/lib/vpc";

import { Password } from "@cdktf/provider-random/lib/password";
import { RandomProvider } from "@cdktf/provider-random/lib/provider";

export class AwsStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, "aws", {
      region: "us-east-1",
    });

    new RandomProvider(this, "random", {});

    // Create a DB Subnet Group

    const eip = new Eip(this, "Eip", {});

    const vpc = new Vpc(this, "vpc", {
      cidrBlock: "10.0.0.0/16",
      enableDnsSupport: true,
      enableDnsHostnames: true,

      tags: {
        Name: "my-vpc",
      },
    });

    const publicSubnet1 = new Subnet(this, "subnet1", {
      vpcId: vpc.id,
      cidrBlock: "10.0.100.0/24",
      availabilityZone: "us-east-1a",

      tags: {
        Name: "my-subnet-1",
      },
    });

    const subnet2 = new Subnet(this, "subnet2", {
      vpcId: vpc.id,
      cidrBlock: "10.0.200.0/24",
      availabilityZone: "us-east-1b",
      tags: {
        Name: "my-subnet-2",
      },
    });

    const privateSubnet1 = new Subnet(this, "privateSubnet1", {
      vpcId: vpc.id,
      cidrBlock: "10.0.1.0/24",
      availabilityZone: "us-east-1a",
      tags: {
        Name: "my-private-subnet1",
      },
    });

    const privateSubnet2 = new Subnet(this, "privateSubnet2", {
      vpcId: vpc.id,
      cidrBlock: "10.0.2.0/24",
      availabilityZone: "us-east-1b",
      tags: {
        Name: "my-private-subnet2",
      },
    });

    const dbSubnetGroup = new DbSubnetGroup(this, "DbSubnetGroup", {
      name: "my-db-subnet-group",
      subnetIds: [privateSubnet1.id, privateSubnet2.id],
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
    new RouteTableAssociation(this, "PublicSubnetAssociation", {
      subnetId: publicSubnet1.id,
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

    new RouteTableAssociation(this, "PrivateSubnetAssociation", {
      subnetId: subnet2.id, // Assuming subnet2 is the private subnet
      routeTableId: privateRouteTable.id,
    });

    const ecsCluster = new EcsCluster(this, "ecsCluster", {
      name: "my-cluster",
    });

    const jumpBoxSecurityGroup = new SecurityGroup(
      this,
      "jumpBoxSecurityGroup",
      {
        vpcId: vpc.id,
        name: "jump-box-sg",
        description: "Security group for Jump Box",
        ingress: [
          {
            description: "Allow SSH",
            fromPort: 22,
            toPort: 22,
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
      }
    );

    const jumpBox = new Instance(this, "jumpBox", {
      ami: "ami-080e1f13689e07408", // Ubuntu 22.04
      instanceType: "t2.micro",
      subnetId: publicSubnet1.id,
      keyName: "MyKeyPair", // replace with your key pair name
      vpcSecurityGroupIds: [jumpBoxSecurityGroup.id],
    });

    const jumpBoxEip = new Eip(this, "JumpBoxEip", {
      domain: "vpc",
      instance: jumpBox.id,
    });

    const taskRole = new IamRole(this, "taskRole", {
      name: "taskRole",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Principal: {
              Service: "ecs-tasks.amazonaws.com",
            },
            Effect: "Allow",
          },
        ],
      }),
    });

    new IamRolePolicyAttachment(this, "taskRolePolicyAttachment", {
      role: taskRole.name,
      policyArn:
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    });

    const ecrRepo = new EcrRepository(this, "EcrRepo", {
      name: "my-ecr-repo", // replace with your repository name
    });

    const taskDefinition = new EcsTaskDefinition(this, "taskDefinition", {
      family: "nginx-task",
      cpu: "256",
      memory: "512",
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      executionRoleArn: taskRole.arn,
      containerDefinitions: Fn.jsonencode([
        {
          name: "nginx",
          image: `${ecrRepo.repositoryUrl}:alpine`,
          essential: true,
          portMappings: [
            {
              containerPort: 80,
              hostPort: 80,
              protocol: "tcp",
            },
          ],
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": "/ecs/my-log-group",
              "awslogs-region": "us-east-1",
              "awslogs-stream-prefix": "ecs",
            },
          },
        },
      ]),
    });

    const securityGroup = new SecurityGroup(this, "securityGroup", {
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

    new CloudwatchLogGroup(this, "LogGroup", {
      name: "/ecs/my-log-group", // replace with your log group name
      retentionInDays: 14, // replace with your desired retention period
    });

    new EcsService(this, "ecsService", {
      name: "ecs-example-service",
      cluster: ecsCluster.id,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: [publicSubnet1.id, subnet2.id],
        assignPublicIp: true,
        securityGroups: [securityGroup.id],
      },
    });

    new TerraformOutput(this, "JumpBoxPublicIp", {
      value: jumpBoxEip.publicIp,
    });
  }
}
