import { toCareer,toEmployee,toEmployees,toRecommendations } from './mappers'
import { mockAdapter } from './mockAdapter'
import { ApiError,type CareerView,type Employee,type Recommendation } from './types'
export const apiBaseUrl=(import.meta.env.VITE_API_URL||'http://localhost:8000').replace(/\/+$/,'')
export const useMock=import.meta.env.VITE_USE_MOCK==='true'
async function request(path:string,options?:RequestInit):Promise<unknown>{let response:Response;try{response=await fetch(`${apiBaseUrl}${path}`,{...options,headers:{Accept:'application/json',...options?.headers}})}catch{throw new ApiError('Backend is unavailable. Check the API URL and that the server is running.','unavailable')}if(!response.ok)throw new ApiError(`API request failed (${response.status}).`,'http',response.status);if(options?.method==='POST'||response.status===204)return undefined;const body=await response.text();if(!body)return undefined;try{return JSON.parse(body) as unknown}catch{throw new ApiError('API returned invalid JSON.','invalid')}}
const id=encodeURIComponent
export async function getEmployees():Promise<Employee[]>{return useMock?mockAdapter.getEmployees():toEmployees(await request('/employees'))}
export async function getEmployee(employeeId:string):Promise<Employee>{return useMock?mockAdapter.getEmployee(employeeId):toEmployee(await request(`/employees/${id(employeeId)}`))}
export async function getCareer(employeeId:string):Promise<CareerView>{return useMock?mockAdapter.getCareer(employeeId):toCareer(await request(`/employees/${id(employeeId)}/career`))}
export async function getRecommendations(employeeId:string):Promise<Recommendation[]>{return useMock?mockAdapter.getRecommendations(employeeId):toRecommendations(await request(`/employees/${id(employeeId)}/recommendations`))}
export async function completeActivity(employeeId:string,eventId:string):Promise<void>{if(useMock)return mockAdapter.completeActivity(employeeId,eventId);await request(`/employees/${id(employeeId)}/activities/${id(eventId)}/complete`,{method:'POST'})}
