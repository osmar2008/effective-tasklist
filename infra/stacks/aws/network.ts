import { Eip } from "@cdktf/provider-aws/lib/eip";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { Vpc } from "@cdktf/provider-aws/lib/vpc";
import { Construct } from "constructs";

export const AWS_DEFAULT_ZONE = "us-east-1";
export const AWS_DEFAULT_ZONEA = "us-east-1a";
export const AWS_DEFAULT_ZONEB = "us-east-1b";

export const VPC_CIDR_BLOCK = "10.0.0.0/16";
export const PUBLIC_SUBNET_1_CIDR_BLOCK = "10.0.100.0/24";
export const PUBLIC_SUBNET_2_CIDR_BLOCK = "10.0.200.0/24";
export const PRIVATE_SUBNET_1_CIDR_BLOCK = "10.0.1.0/24";
export const PRIVATE_SUBNET_2_CIDR_BLOCK = "10.0.2.0/24";

export const withConstruct = (construct: Construct) => ({
  setupVPC: () => ({
    vpc: new Vpc(construct, "mainVpc", {
      cidrBlock: VPC_CIDR_BLOCK,
      enableDnsSupport: true,
      enableDnsHostnames: true,
      tags: {
        Name: "mainVpc",
      },
    }),
  }),

  getNetworkStackBuilder: (vpc: Vpc) => ({
    eip: new Eip(construct, "Eip", {}),

    publicSubnet1: new Subnet(construct, "publicSubnet1", {
      vpcId: vpc.id,
      cidrBlock: PUBLIC_SUBNET_1_CIDR_BLOCK,
      availabilityZone: AWS_DEFAULT_ZONEA,
      tags: {
        availabilty: "public",
        Name: "publicSubnet1",
      },
    }),

    // publicSubnet2: new Subnet(construct, "publicSubnet2", {
    //   vpcId: vpc.id,
    //   cidrBlock: PUBLIC_SUBNET_2_CIDR_BLOCK,
    //   availabilityZone: AWS_DEFAULT_ZONEB,
    //   tags: {
    //     availabilty: "public",
    //     Name: "publicSubnet2",
    //   },
    // }),

    privateSubnet1: new Subnet(construct, "privateSubnet1", {
      vpcId: vpc.id,
      cidrBlock: PRIVATE_SUBNET_1_CIDR_BLOCK,
      availabilityZone: AWS_DEFAULT_ZONEA,
      tags: {
        availabilty: "private",
        Name: "privateSubnet1",
      },
    }),

    // privateSubnet2: new Subnet(construct, "privateSubnet2", {
    //   vpcId: vpc.id,
    //   cidrBlock: PRIVATE_SUBNET_2_CIDR_BLOCK,
    //   availabilityZone: AWS_DEFAULT_ZONEB,
    //   tags: {
    //     availabilty: "private",
    //     Name: "privateSubnet2",
    //   },
    // }),
  }),
});
