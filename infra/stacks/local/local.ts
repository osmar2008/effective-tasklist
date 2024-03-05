import { Construct } from 'constructs'
import { TerraformStack } from 'cdktf'
import { Container, DockerProvider, Image } from '../../.gen/providers/docker'

export class LocalStack extends TerraformStack {
  public readonly builderContainer: Container

  constructor(scope: Construct, id: string) {
    super(scope, id)

    new DockerProvider(this, 'docker', {})

    const builderImage = new Image(this, 'builder', {
      name: 'effective-tasklist-builder',
      buildAttribute: {
        context: `/Users/osmar/Projects/effective-tasklist/`,
        dockerfile: `/Users/osmar/Projects/effective-tasklist/Dockerfile`,
      },
      keepLocally: false,
    })

    this.builderContainer = new Container(this, 'dockerContainer', {
      image: builderImage.name,
      name: 'effective-tasklist-builder',
    })
  }
}
