import { test as base } from "@playwright/test";
import path from "path";

export const CUSTOMER_STATE = path.join(__dirname, "../.auth/customer.json");
export const STAFF_STATE = path.join(__dirname, "../.auth/staff.json");
export const ADMIN_STATE = path.join(__dirname, "../.auth/admin.json");
export const NO_AUTH_STATE = { cookies: [] as never[], origins: [] as never[] };

export const test = base;
export { expect } from "@playwright/test";
