use std::path::PathBuf;

fn main() {
    // Set output directory for TypeScript types
    let out_dir = PathBuf::from("target/typeshare");
    std::fs::create_dir_all(&out_dir).ok();
    
    println!("cargo:rerun-if-changed=src/models");
}
