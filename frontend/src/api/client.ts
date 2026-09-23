import { toCareer, toEmployee, toEmployees, toRecommendations } from './mappers';
import { ApiError, type CareerView, type Employee, type Recommendation } from './types';
export const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
export async function request(path: string, options?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...options?.headers
      }
    });
  } catch {
    throw new ApiError('Сервер недоступен. Проверьте адрес API и работу сервера.', 'unavailable');
  }
  if (!response.ok) {
    if (response.status >= 500) throw new ApiError(`Сервер недоступен или вернул ошибку (${response.status}).`, 'unavailable', response.status);
    const message = path === '/demo/import-profile' && response.status === 409
      ? 'Сотрудник с таким ID уже существует.'
      : path === '/demo/import-profile' && response.status === 422
        ? 'Некорректный профиль. Проверьте обязательные поля, навыки и историю.'
        : response.status === 404
          ? 'Запрошенные данные не найдены.'
          : response.status === 409
            ? 'Действие недоступно или уже выполнено.'
            : response.status === 422
              ? 'Запрос содержит некорректные данные.'
              : `Не удалось выполнить запрос к API (${response.status}).`;
    throw new ApiError(message, 'http', response.status);
  }
  if (response.status === 204) return undefined;
  const body = await response.text();
  if (!body) return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ApiError('Сервер вернул некорректный JSON.', 'invalid');
  }
}
const id = encodeURIComponent;
export async function getEmployees(): Promise<Employee[]> {
  return toEmployees(await request('/employees'));
}
export async function getEmployee(employeeId: string): Promise<Employee> {
  return toEmployee(await request(`/employees/${id(employeeId)}`));
}
export async function getCareer(employeeId: string): Promise<CareerView> {
  return toCareer(await request(`/employees/${id(employeeId)}/career`));
}
export async function getRecommendations(employeeId: string): Promise<Recommendation[]> {
  return toRecommendations(await request(`/employees/${id(employeeId)}/recommendations`));
}
export async function completeActivity(employeeId: string, eventId: string): Promise<void> {
  await request(`/employees/${id(employeeId)}/activities/${id(eventId)}/complete`, {
    method: 'POST'
  });
}

export async function importProfile(payload: unknown): Promise<{ employee_id: string }> {
  const result = await request('/demo/import-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!result || typeof result !== 'object' || typeof (result as { employee_id?: unknown }).employee_id !== 'string') {
    throw new ApiError('В ответе импорта отсутствует employee_id.', 'invalid');
  }
  return result as { employee_id: string };
}
