pub mod room;
pub mod shelving_unit;
pub mod user;

// Re-export types for convenience
// Suppress unused warnings for now as these will be used when we add routes
#[allow(unused_imports)]
pub use room::*;
#[allow(unused_imports)]
pub use shelving_unit::*;
#[allow(unused_imports)]
pub use user::*;
