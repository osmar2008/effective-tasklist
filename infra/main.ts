import { App } from 'cdktf'
import { AwsStack } from './stacks/aws/main'
import { LocalStack } from './stacks/local/local'

// class MyStack extends TerraformStack {
//   constructor(scope: Construct, id: string) {
//     super(scope, id)
//
//     const image = new Image(this, 'image', {
//       name: 'nginx:latest',
//       keepLocally: false,
//     })
//
//     new Container(this, 'nginxContainer', {
//       image: image.name,
//       name: 'nginx',
//       ports: [
//         {
//           internal: 80,
//           external: 8000,
//         },
//       ],
//     })
//   }
// }

const app = new App()
new AwsStack(app, 'aws-dev')
new LocalStack(app, 'local')
app.synth()
