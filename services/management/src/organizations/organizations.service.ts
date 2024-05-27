import { Injectable } from '@nestjs/common'
import type { CreateOrganizationDto } from './dto/create-organization.dto'
import type { UpdateOrganizationDto } from './dto/update-organization.dto'

@Injectable()
export class OrganizationsService {
  create(createOrganizationDto: CreateOrganizationDto) {
    // console.log("This action adds a new organization");
    return createOrganizationDto
  }

  findAll() {
    return 'This action returns all organizations'
  }

  findOne(id: number) {
    return `This action returns a #${id} organization`
  }

  update(id: number, updateOrganizationDto: UpdateOrganizationDto) {
    //   console.log(`This action updates a #${id} organization`)

    return updateOrganizationDto
  }

  remove(id: number) {
    return `This action removes a #${id} organization`
  }
}
