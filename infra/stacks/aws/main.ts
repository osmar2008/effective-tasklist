import { Construct } from 'constructs'
import { TerraformStack } from 'cdktf'
import { setupIam } from './iam'
import {
  AwsProvider,
  CloudwatchLogGroup,
  EcsCluster,
  EcsService,
  EcsTaskDefinition,
  Eip,
  InternetGateway,
  NatGateway,
  Route,
  RouteTable,
  RouteTableAssociation,
  SecurityGroup,
  Subnet,
  Vpc,
} from '../../.gen/providers/aws'

export class AwsStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id)
    const { ecsTaskExecutionRole } = setupIam.call(this)

    const vpc = new Vpc(this, 'Vpc', {
      cidrBlock: '10.0.0.0/16',
    })

    const internetGateway = new InternetGateway(this, 'InternetGateway', { vpcId: vpc.id })

    const subnet1 = new Subnet(this, 'Subnet1', {
      vpcId: vpc.id,
      cidrBlock: '10.0.1.0/24',
    })

    const subnet2 = new Subnet(this, 'Subnet2', {
      vpcId: vpc.id,
      cidrBlock: '10.0.2.0/24',
    })

    const eip = new Eip(this, 'Eip', {})

    new NatGateway(this, 'NatGateway', {
      allocationId: eip.id,
      subnetId: subnet1.id,
    })

    const routeTable = new RouteTable(this, 'RouteTable', {
      vpcId: vpc.id,
    })

    new Route(this, 'Route', {
      routeTableId: routeTable.id,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: internetGateway.id,
    })

    new RouteTableAssociation(this, 'RouteTableAssociation', {
      subnetId: subnet2.id,
      routeTableId: routeTable.id,
    })

    const securityGroup = new SecurityGroup(this, 'SecurityGroup', {
      vpcId: vpc.id,
      ingress: [
        {
          description: 'Allow inbound HTTP/HTTPS',
          fromPort: 80,
          toPort: 443,
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

    new AwsProvider(this, 'aws', {
      region: 'us-east-1',
    })

    const cluster = new EcsCluster(this, 'cluster', {
      name: 'new-cluster',
    })

    new CloudwatchLogGroup(this, 'LogGroup', {
      name: 'ecs-logs',
      retentionInDays: 14, // replace with your desired retention period in days
    })

    const taskDefinition = new EcsTaskDefinition(this, 'taskDefinition', {
      family: 'new-task',
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      cpu: '256',
      memory: '512',
      executionRoleArn: ecsTaskExecutionRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name: 'new-container',
          image: `nginx:latest`,

          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': 'ecs-logs',
              'awslogs-region': 'us-east-1',
              'awslogs-stream-prefix': 'ecs',
            },
          },
          portMappings: [
            {
              containerPort: 80,
              hostPort: 80,
              protocol: 'tcp',
            },
          ],
        },
      ]),
    })

    new EcsService(this, 'Service', {
      name: 'my-service',
      cluster: cluster.id,
      taskDefinition: taskDefinition.arn,
      desiredCount: 1,
      launchType: 'FARGATE',
      networkConfiguration: {
        subnets: [subnet1.id, subnet2.id],
        assignPublicIp: true,
        securityGroups: [securityGroup.id],
      },
    })
  }
}
