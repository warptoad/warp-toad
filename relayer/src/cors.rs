use rocket::{
    Request, Response,
    fairing::{Fairing, Info, Kind},
    http::{Header, Method, Status},
};

pub struct Cors;

#[rocket::async_trait]
impl Fairing for Cors {
    fn info(&self) -> Info {
        Info {
            name: "CORS Fairing",
            kind: Kind::Response | Kind::Request,
        }
    }

    async fn on_request(&self, request: &mut Request<'_>, _: &mut rocket::Data<'_>) {
        // We don't need to do anything special here for OPTIONS requests
        // The main handling will be in on_response
    }

    async fn on_response<'r>(&self, request: &'r Request<'_>, response: &mut Response<'r>) {
        // Set CORS headers for all responses
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new(
            "Access-Control-Allow-Methods",
            "POST, GET, PATCH, OPTIONS",
        ));
        response.set_header(Header::new(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization",
        ));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));

        // For OPTIONS requests, we need to return 204 No Content
        if request.method() == Method::Options {
            response.set_status(Status::NoContent);
        }
    }
}
