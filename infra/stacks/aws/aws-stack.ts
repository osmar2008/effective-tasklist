import { Fn, TerraformStack } from "cdktf";
import { Construct } from "constructs";

import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch-log-group";
import { EcrRepository } from "@cdktf/provider-aws/lib/ecr-repository";
import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { NatGateway } from "@cdktf/provider-aws/lib/nat-gateway";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";

import { Route } from "@cdktf/provider-aws/lib/route";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";

import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { VpcEndpoint } from "@cdktf/provider-aws/lib/vpc-endpoint";

import { RandomProvider } from "@cdktf/provider-random/lib/provider";

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

    const { privateSubnet1, publicSubnet1, eip } =
      networkStack.getNetworkStackBuilder(vpc);

    const internetGateway = new InternetGateway(this, "InternetGateway", {
      vpcId: vpc.id,
    });

    const natGateway = new NatGateway(this, "NatGateway", {
      allocationId: eip.id,
      subnetId: publicSubnet1.id,
    });

    const publicRouteTable = new RouteTable(this, "PublicRouteTable", {
      vpcId: vpc.id,
    });

    new Route(this, "InternetRoute", {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    });

    new RouteTableAssociation(this, "PublicSubnet1Association", {
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

    new RouteTableAssociation(this, "PrivateSubnet1Association", {
      subnetId: privateSubnet1.id,
      routeTableId: privateRouteTable.id,
    });

    const ecrRepo = new EcrRepository(this, "EcrRepo", {
      name: "my-ecr-repo",
      forceDelete: true,
    });

    const ecsCluster = new EcsCluster(this, "ecsCluster", {
      name: "my-cluster",
    });

    new CloudwatchLogGroup(this, "LogGroup", {
      name: "/ecs/my-log-group",
      retentionInDays: 14,
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
      subnetIds: [privateSubnet1.id],
      securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
    });

    new VpcEndpoint(this, "VpcEndpointEcrApi", {
      vpcId: vpc.id,
      vpcEndpointType: "Interface",
      serviceName: "com.amazonaws.us-east-1.ecr.api",
      privateDnsEnabled: true,
      subnetIds: [privateSubnet1.id],
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
      subnetIds: [privateSubnet1.id],
      securityGroupIds: [vpcEndpointSecurityGroup.id, ecsSecurityGroup.id],
    });

    new VpcEndpoint(this, "VpcEndpointCloudWatch", {
      vpcId: vpc.id,
      vpcEndpointType: "Interface",
      serviceName: "com.amazonaws.us-east-1.logs",
      privateDnsEnabled: true,
      subnetIds: [privateSubnet1.id],
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
      tags: { id: "NGINX-TASK_DEFINITION" },
      containerDefinitions: Fn.jsonencode([containerDefinitions]),
    });

    new EcsService(this, "ecsService", {
      name: "ecs-example-service",
      cluster: ecsCluster.id,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: [privateSubnet1.id],
        securityGroups: [ecsSecurityGroup.id, vpcEndpointSecurityGroup.id],
      },
      deploymentMaximumPercent: 200,
      deploymentMinimumHealthyPercent: 50,
      deploymentCircuitBreaker: {
        enable: true,
        rollback: true,
      },
    });
  }
}
