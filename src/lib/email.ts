import { Resend } from "resend";

// Ленивая инициализация — не падаем при build, если ключа нет
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev"; // resend.dev works for testing

/**
 * Отправка инвайт-ссылки на email
 */
export async function sendInviteEmail(to: string, inviteUrl: string, role: string) {
  const roleLabel = role === "ADMIN" ? "Администратор" : "Пользователь";
  const resend = getResend();
  if (!resend) return { success: false, error: "RESEND_API_KEY не настроен" };

  try {
    const { data, error } = await resend.emails.send({
      from: `Корпоративное обучение <${FROM_EMAIL}>`,
      to,
      subject: "Приглашение на платформу корпоративного обучения",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Корпоративное обучение — Global ERP</h2>
          <p>Вам выдан доступ к платформе корпоративного обучения.</p>
          <p><strong>Роль:</strong> ${roleLabel}</p>
          <p>Для регистрации перейдите по ссылке:</p>
          <a href="${inviteUrl}"
             style="display: inline-block; padding: 12px 24px; background: #1e293b; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
            Зарегистрироваться
          </a>
          <p style="color: #64748b; font-size: 14px;">
            Если кнопка не работает, скопируйте ссылку:<br/>
            <a href="${inviteUrl}">${inviteUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">
            Это автоматическое сообщение. Если вы получили его по ошибке, проигнорируйте.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Ошибка отправки email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (e) {
    console.error("Ошибка Resend:", e);
    return { success: false, error: String(e) };
  }
}

/**
 * Уведомление о начале обучения
 */
export async function sendTrainingStartEmail(to: string, courseName: string, startDate: string, groupName: string) {
  const resend = getResend();
  if (!resend) return { success: false, error: "RESEND_API_KEY не настроен" };

  try {
    const { data, error } = await resend.emails.send({
      from: `Корпоративное обучение <${FROM_EMAIL}>`,
      to,
      subject: `Начало обучения: ${courseName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Начало обучения</h2>
          <p>Ваше обучение скоро начинается!</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; color: #64748b;">Курс:</td>
              <td style="padding: 8px; font-weight: bold;">${courseName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; color: #64748b;">Группа:</td>
              <td style="padding: 8px; font-weight: bold;">${groupName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; color: #64748b;">Дата начала:</td>
              <td style="padding: 8px; font-weight: bold;">${startDate}</td>
            </tr>
          </table>
          <p style="color: #64748b;">Желаем успешного обучения!</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Корпоративное обучение — Global ERP</p>
        </div>
      `,
    });

    if (error) {
      console.error("Ошибка отправки email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (e) {
    console.error("Ошибка Resend:", e);
    return { success: false, error: String(e) };
  }
}

/**
 * Уведомление о завершении обучения
 */
export async function sendTrainingCompleteEmail(to: string, courseName: string, progress: number) {
  const resend = getResend();
  if (!resend) return { success: false, error: "RESEND_API_KEY не настроен" };

  try {
    const { data, error } = await resend.emails.send({
      from: `Корпоративное обучение <${FROM_EMAIL}>`,
      to,
      subject: `Обучение завершено: ${courseName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Обучение завершено!</h2>
          <p>Поздравляем! Вы завершили курс <strong>${courseName}</strong>.</p>
          <p>Итоговый прогресс: <strong>${progress}%</strong></p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Корпоративное обучение — Global ERP</p>
        </div>
      `,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
