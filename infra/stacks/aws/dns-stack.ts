import { TerraformStack, Token } from 'cdktf'
import { Construct } from 'constructs'

import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate'
import { DataAwsRoute53Zone } from '@cdktf/provider-aws/lib/data-aws-route53-zone'
import { AwsProvider } from '@cdktf/provider-aws/lib/provider'
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record'

export class DnsStack extends TerraformStack {
	constructor(scope: Construct, name: string) {
		super(scope, name)

		new AwsProvider(this, 'aws', {
			region: 'us-east-1',
		})
		const existingRouteZone = new DataAwsRoute53Zone(this, 'route-53-data-zone-1', {
			name: 'tasklist.effectivedev.blog',
		})

		new Route53Record(this, 'tasklist', {
			name: 'tasklist.effectivedev.blog',
			ttl: Token.asNumber('300'),
			type: 'A',
			zoneId: Token.asString(existingRouteZone.zoneId),
		})

		const certificate = new AcmCertificate(this, 'acm-certificate', {
			domainName: 'tasklist.effectivedev.blog',
			validationMethod: 'DNS',
		})

		new Route53Record(this, 'acm-certificate-validation-record', {
			zoneId: existingRouteZone.zoneId,
			name: certificate.domainValidationOptions.get(0).resourceRecordName,
			type: certificate.domainValidationOptions.get(0).resourceRecordType,
			records: [certificate.domainValidationOptions.get(0).resourceRecordValue],
			ttl: 60,
		})
	}
}
