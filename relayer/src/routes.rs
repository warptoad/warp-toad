use rocket::{State, post, routes, serde::json::Json};

#[get("/")]
pub fn hello() -> String {
    "Hello!".to_string()
}
