import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { Booking, BookingFilters } from './types';

/**
 * Wraps /booking. Every method returns the raw APIResponse so specs decide
 * what to assert. A `token` is sent as the `token` cookie; omit it to make an
 * unauthenticated call.
 */
export class BookingClient {
  constructor(private readonly request: APIRequestContext) {}

  private authHeaders(token?: string): Record<string, string> {
    return token === undefined ? {} : { Cookie: `token=${token}` };
  }

  create(booking: Booking): Promise<APIResponse> {
    return this.request.post('/booking', { data: booking });
  }

  /** Sends an arbitrary body and headers, for malformed payload and wrong content type cases. */
  createRaw(body: string, headers: Record<string, string> = {}): Promise<APIResponse> {
    return this.request.post('/booking', { data: body, headers });
  }

  get(id: number | string): Promise<APIResponse> {
    return this.request.get(`/booking/${id}`);
  }

  list(filters: BookingFilters = {}): Promise<APIResponse> {
    return this.request.get('/booking', { params: { ...filters } });
  }

  update(id: number | string, booking: Partial<Booking>, token?: string): Promise<APIResponse> {
    return this.request.put(`/booking/${id}`, {
      data: booking,
      headers: this.authHeaders(token),
    });
  }

  partialUpdate(id: number | string, fields: Partial<Booking>, token?: string): Promise<APIResponse> {
    return this.request.patch(`/booking/${id}`, {
      data: fields,
      headers: this.authHeaders(token),
    });
  }

  delete(id: number | string, token?: string): Promise<APIResponse> {
    return this.request.delete(`/booking/${id}`, { headers: this.authHeaders(token) });
  }
}
