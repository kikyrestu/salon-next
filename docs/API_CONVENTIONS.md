# API Conventions — Salon Next Customization

> Follow these conventions for every new API route. Consistency is mandatory.

---

## Base URL Pattern

```
/api/{resource}
/api/{resource}/{id}
/api/{resource}/{id}/{action}
```

Examples:
```
GET    /api/customers
GET    /api/customers/:id
POST   /api/customers
PUT    /api/customers/:id
DELETE /api/customers/:id
POST   /api/customers/:id/redeem-points
POST   /api/vouchers/:code/validate
```

---

## HTTP Methods

| Method | Usage |
|---|---|
| `GET` | Fetch data (list or single) |
| `POST` | Create new resource or trigger an action |
| `PUT` | Update existing resource (full or partial) |
| `DELETE` | Soft delete preferred — add `isActive: false` instead of removing |

---

## Request Format

- Content-Type: `application/json`
- For file uploads: `multipart/form-data`
- Date params: ISO 8601 string (`2024-01-15T00:00:00.000Z`)

---

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Success with pagination

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE_SNAKE_CASE"
}
```

---

## HTTP Status Codes

| Code | When to use |
|---|---|
| `200` | Successful GET, PUT |
| `201` | Successful POST (resource created) |
| `400` | Bad request (validation error, missing fields) |
| `401` | Unauthenticated |
| `403` | Unauthorized (logged in but no permission) |
| `404` | Resource not found |
| `409` | Conflict (duplicate, already exists) |
| `500` | Unexpected server error |

---

## Query Parameters (for GET list endpoints)

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `sortBy` | string | Field name to sort by |
| `sortOrder` | `asc` \| `desc` | Sort direction (default: desc) |
| `startDate` | ISO string | Filter from date |
| `endDate` | ISO string | Filter to date |
| `paymentMethod` | string | Filter by payment method |
| `search` | string | Search keyword |

Example:
```
GET /api/reports/sales?startDate=2024-01-01&endDate=2024-01-31&paymentMethod=cash&sortBy=total&sortOrder=desc
```

---

## File Upload

- Use `multipart/form-data`
- Images: auto-resize to max width 1200px before saving (use `sharp`)
- Save to `/public/uploads/{resource}/` or cloud storage (check existing pattern)
- Return `imageUrl` as relative path in response

---

## New Route Checklist

Before adding a new route, verify:
- [ ] Does this route already exist in the codebase?
- [ ] Is the resource name consistent with existing routes?
- [ ] Is auth middleware applied?
- [ ] Is input validated before hitting the database?
- [ ] Is the response format following the standard above?
