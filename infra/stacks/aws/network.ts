import { Eip } from "@cdktf/provider-aws/lib/eip";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { NatGateway } from "@cdktf/provider-aws/lib/nat-gateway";
import { Route } from "@cdktf/provider-aws/lib/route";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { Vpc } from "@cdktf/provider-aws/lib/vpc";
import { Construct } from "constructs";

export const AWS_DEFAULT_ZONE = "us-east-1";
export const AWS_DEFAULT_ZONEA = "us-east-1a";
export const AWS_DEFAULT_ZONEB = "us-east-1b";

export const VPC_CIDR_BLOCK = "10.0.0.0/16";
export const PUBLIC_SUBNET_1A_CIDR_BLOCK = "10.0.100.0/24";
export const PUBLIC_SUBNET_1B_CIDR_BLOCK = "10.0.200.0/24";
export const PRIVATE_SUBNET_1A_CIDR_BLOCK = "10.0.1.0/24";
export const PRIVATE_SUBNET_1B_CIDR_BLOCK = "10.0.2.0/24";

export const withConstruct = (construct: Construct) => {
  const getInternetGatway = (vpc: Vpc) =>
    new InternetGateway(construct, "main_internet_gateway", {
      vpcId: vpc.id,
      tags: {
        Name: "main_internet_gateway",
      },
    });

  const getNatGateway = (eip: Eip, publicSubnet: Subnet, name: string) =>
    new NatGateway(construct, `${name}-nat-gateway`, {
      allocationId: eip.id,
      subnetId: publicSubnet.id,
    });

  const buildPublicSubnet = <
    Zone extends `${typeof AWS_DEFAULT_ZONE}${
      | "a"
      | "b"
      | "c"
      | "d"
      | "e"
      | "f"}`
  >(
    vpc: Vpc,
    internetGateway: InternetGateway,
    name: `public_subnet_${Zone}`,
    cidrBlock: `${number}.${number}.${number}.${number}/${number}`,
    availabilityZone: Zone
  ) => {
    const publicSubnet = new Subnet(construct, name, {
      vpcId: vpc.id,
      cidrBlock,
      availabilityZone,
      tags: {
        availabilty: "public",
        Name: name,
      },
    });

    const publicRouteTable = new RouteTable(construct, `${name}_route_table`, {
      vpcId: vpc.id,
    });

    new RouteTableAssociation(construct, `${name}_route_table_association`, {
      subnetId: publicSubnet.id,
      routeTableId: publicRouteTable.id,
    });

    new Route(construct, `${name}_internet_gateway`, {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    });

    return { publicSubnet };
  };

  const buildPrivateSubnet = <
    Zone extends `${typeof AWS_DEFAULT_ZONE}${
      | "a"
      | "b"
      | "c"
      | "d"
      | "e"
      | "f"}`
  >(
    vpc: Vpc,
    natGateway: NatGateway,
    name: `private_subnet_${Zone}`,
    cidrBlock: `${number}.${number}.${number}.${number}/${number}`,
    availabilityZone: Zone
  ) => {
    const privateSubnet = new Subnet(construct, name, {
      vpcId: vpc.id,
      cidrBlock,
      availabilityZone,
      tags: {
        availabilty: "private",
        Name: name,
      },
    });

    const privateRouteTable = new RouteTable(construct, `${name}_route_table`, {
      vpcId: vpc.id,
    });

    new RouteTableAssociation(construct, `${name}_route_table_association`, {
      subnetId: privateSubnet.id,
      routeTableId: privateRouteTable.id,
    });

    new Route(construct, `${name}_nat_gateway`, {
      routeTableId: privateRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway.id,
    });
    return { privateSubnet };
  };

  return {
    buildNetworkStack: (vpc: Vpc) => {
      const internetGateway = getInternetGatway(vpc);

      const { publicSubnet: publicSubnet1a } = buildPublicSubnet(
        vpc,
        internetGateway,
        "public_subnet_us-east-1a",
        PUBLIC_SUBNET_1A_CIDR_BLOCK,
        AWS_DEFAULT_ZONEA
      );

      const { publicSubnet: publicSubnet1b } = buildPublicSubnet(
        vpc,
        internetGateway,
        "public_subnet_us-east-1b",
        PUBLIC_SUBNET_1B_CIDR_BLOCK,
        AWS_DEFAULT_ZONEB
      );

      const { privateSubnet: privateSubnet1a } = buildPrivateSubnet(
        vpc,
        getNatGateway(
          new Eip(construct, "public_subnet_us-east-1a-nat-gateway-ip"),
          publicSubnet1a,
          "public_subnet_us-east-1a"
        ),
        "private_subnet_us-east-1a",
        PRIVATE_SUBNET_1A_CIDR_BLOCK,
        AWS_DEFAULT_ZONEA
      );

      const { privateSubnet: privateSubnet1b } = buildPrivateSubnet(
        vpc,
        getNatGateway(
          new Eip(construct, "public_subnet_us-east-1b-nat-gateway-ip"),
          publicSubnet1b,
          "private_subnet_us-east-1b"
        ),
        "private_subnet_us-east-1b",
        PRIVATE_SUBNET_1B_CIDR_BLOCK,
        AWS_DEFAULT_ZONEB
      );

      return {
        privateSubnet1a,
        publicSubnet1a,
        privateSubnet1b,
        publicSubnet1b,
      };
    },
  };
};
