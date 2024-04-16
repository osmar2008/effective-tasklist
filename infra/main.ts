import { App } from "cdktf";

import { AwsStack } from "./stacks/aws/aws-stack";
import { LocalStack } from "./stacks/local/local-stack";

const app = new App();
new LocalStack(app, "local");
new AwsStack(app, "aws");
app.synth();
