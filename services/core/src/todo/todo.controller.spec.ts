import { Test, type TestingModule } from '@nestjs/testing'
import { TodoController } from './todo.controller.js'
import { TodoService } from './todo.service.js'

describe('TodoController', () => {
  let controller: TodoController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodoController],
      providers: [TodoService],
    }).compile()

    controller = module.get<TodoController>(TodoController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
