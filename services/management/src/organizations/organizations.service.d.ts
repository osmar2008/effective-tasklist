import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
export declare class OrganizationsService {
    create(createOrganizationDto: CreateOrganizationDto): CreateOrganizationDto;
    findAll(): string;
    findOne(id: number): string;
    update(id: number, updateOrganizationDto: UpdateOrganizationDto): UpdateOrganizationDto;
    remove(id: number): string;
}
