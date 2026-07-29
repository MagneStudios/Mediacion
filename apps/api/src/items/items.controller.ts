import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/current-user.decorator";
import { ItemsService } from "./items.service";
import type { CreateItemDto, OwnItem, UpdateItemDto } from "./items.types";

@Controller()
export class ItemsController {
  constructor(
    @Inject(ItemsService) private readonly itemsService: ItemsService,
  ) {}

  @Post("casos/:casoId/items")
  createItem(
    @Param("casoId") casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: CreateItemDto,
  ): Promise<OwnItem> {
    return this.itemsService.createOwnItem(casoId, caller.id, body);
  }

  @Get("casos/:casoId/items")
  listItems(
    @Param("casoId") casoId: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<OwnItem[]> {
    return this.itemsService.listOwnItems(casoId, caller.id);
  }

  @Get("items/:id")
  getItem(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<OwnItem> {
    return this.itemsService.getOwnItem(id, caller.id);
  }

  @Patch("items/:id")
  updateItem(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
    @Body() body: UpdateItemDto,
  ): Promise<OwnItem> {
    return this.itemsService.updateOwnItem(id, caller.id, body);
  }

  @Delete("items/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(
    @Param("id") id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ): Promise<void> {
    return this.itemsService.deleteOwnItem(id, caller.id);
  }
}
