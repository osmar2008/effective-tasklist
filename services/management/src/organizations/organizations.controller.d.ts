import type { OrganizationsService } from './organizations.service';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
export declare class OrganizationsController {
    private readonly organizationsService;
    constructor(organizationsService: OrganizationsService);
    create(createOrganizationDto: CreateOrganizationDto): CreateOrganizationDto;
    findAll(): string;
    findOne(id: string): string;
    update(id: string, updateOrganizationDto: UpdateOrganizationDto): UpdateOrganizationDto;
    remove(id: string): string;
}
