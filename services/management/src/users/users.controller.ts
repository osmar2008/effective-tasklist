import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common'
import type { UsersService } from './users.service'
import type { CreateUserDto } from './dto/create-user.dto'
import type { UpdateUserDto } from './dto/update-user.dto'

@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Post()
	create(@Body() createUserDto: CreateUserDto) {
		return this.usersService.create(createUserDto)
	}

	@Get()
	findAll() {
		return this.usersService.findAll()
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.usersService.findOne(+id)
	}

	@Patch(':id')
	update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
		return this.usersService.update(+id, updateUserDto)
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.usersService.remove(+id)
	}
}
