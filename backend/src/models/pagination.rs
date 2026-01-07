use serde::{Deserialize, Serialize};
use typeshare::typeshare;

#[typeshare]
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[typeshare]
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i32,
    pub limit: i32,
    pub offset: i32,
}

impl<T> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, total: i32, limit: i32, offset: i32) -> Self {
        Self {
            data,
            total,
            limit,
            offset,
        }
    }
}
