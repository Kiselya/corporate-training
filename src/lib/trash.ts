import { prisma } from "./prisma";

/**
 * Сохранение снимка сущности перед удалением (soft delete)
 * Позволяет SUPER_ADMIN восстановить удалённые объекты из корзины
 */
export async function saveToTrash(
  entityType: string,
  entityId: string,
  entityData: any,
  deletedBy: string
) {
  await prisma.deletedItem.create({
    data: {
      entityType,
      entityId,
      entityData,
      deletedBy,
    },
  });
}
