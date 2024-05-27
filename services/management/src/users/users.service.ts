import { Injectable } from '@nestjs/common'
import type { CreateUserDto } from './dto/create-user.dto'
import type { UpdateUserDto } from './dto/update-user.dto'

@Injectable()
export class UsersService {
  create(createUserDto: CreateUserDto) {
    // console.log("This action adds a new user");
    return createUserDto
  }

  findAll() {
    return 'This action returns all users'
  }

  findOne(id: number) {
    return `This action returns a #${id} user`
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    // console.log(`This action updates a #${id} user`);
    return updateUserDto
  }

  remove(id: number) {
    return `This action removes a #${id} user`
  }
}
