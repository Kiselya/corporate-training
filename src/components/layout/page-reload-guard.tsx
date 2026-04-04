"use client";

import { useEffect, useRef } from "react";

/**
 * Компонент-страж: при каждом монтировании проверяет,
 * не восстановлена ли страница из кэша с мёртвым состоянием.
 * Если URL изменился с момента последнего рендера — перезагружает.
 */
export function PageReloadGuard() {
  const initialUrl = useRef<string | null>(null);

  useEffect(() => {
    // Запоминаем URL при первом рендере
    if (initialUrl.current === null) {
      initialUrl.current = window.location.href;
    } else if (initialUrl.current !== window.location.href) {
      // URL изменился но компонент не перемонтировался — кэш!
      window.location.reload();
    }
  });

  return null;
}
