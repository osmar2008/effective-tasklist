import { Route53Zone } from "@cdktf/provider-aws/lib/route53-zone";
import { TerraformStack } from "cdktf";
import { Construct } from "constructs";

import { AcmCertificate } from "@cdktf/provider-aws/lib/acm-certificate";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { Route53Record } from "@cdktf/provider-aws/lib/route53-record";

export class DnsStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, "aws", {
      region: "us-east-1",
    });

    const hostedZone = new Route53Zone(this, "route-53-hosted-zone", {
      name: "effectivedev.blog.", // replace with your domain name
      comment: "Managed by Terraform CDK",
    });

    const certificate = new AcmCertificate(this, "acm-certificate", {
      domainName: "tasklist.effectivedev.blog",
      validationMethod: "DNS",
    });

    new Route53Record(this, "acm-certificate-validation-record", {
      zoneId: hostedZone.zoneId,
      name: certificate.domainValidationOptions.get(0).resourceRecordName,
      type: certificate.domainValidationOptions.get(0).resourceRecordType,
      records: [certificate.domainValidationOptions.get(0).resourceRecordValue],
      ttl: 60,
    });
  }
}
