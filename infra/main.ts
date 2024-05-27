import { App } from 'cdktf'

import { AwsStack } from './stacks/aws/aws-stack'

const app = new App()
new AwsStack(app, 'aws')
app.synth()
