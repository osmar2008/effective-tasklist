import { IamRole } from '../../.gen/providers/aws/iam-role'
import { IamRolePolicyAttachment } from '../../.gen/providers/aws/iam-role-policy-attachment'

export function setupIam(this: any) {
  const ecsTaskExecutionRole = new IamRole(this, 'ecsTaskExecutionRole', {
    name: 'ecsTaskExecutionRole-custom',
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Principal: {
            Service: 'ecs-tasks.amazonaws.com',
          },
          Effect: 'Allow',
        },
      ],
    }),
  })

  const iamRolePolicyAttachment = new IamRolePolicyAttachment(this, 'ecsTaskExecutionRolePolicy', {
    role: ecsTaskExecutionRole.name,
    policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
  })

  return { ecsTaskExecutionRole, iamRolePolicyAttachment }
}
