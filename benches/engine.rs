//! Lightweight stage profiler: optimized Rust, no JS/FFI. Not a public-API benchmark.
#[path = "../src/engine.rs"]
#[allow(dead_code)] // test-only helpers are compiled without a test harness here
mod engine;
#[path = "../src/tree.rs"]
#[allow(dead_code)] // standalone stage harness does not include selection
mod tree;
use std::{
    hint::black_box,
    time::{Duration, Instant},
};

fn sample(mut run: impl FnMut()) -> Vec<f64> {
    for _ in 0..20 {
        run();
    }
    (0..7)
        .map(|_| {
            let start = Instant::now();
            let mut count = 0_u64;
            while start.elapsed() < Duration::from_millis(100) {
                run();
                count += 1;
            }
            start.elapsed().as_secs_f64() * 1e9 / count as f64
        })
        .collect()
}
fn report(name: &str, mut samples: Vec<f64>) {
    let raw = samples.clone();
    samples.sort_by(f64::total_cmp);
    println!("{name}: median_ns={:.0}, samples_ns={raw:?}", samples[3]);
}
fn main() {
    let limits = engine::Limits::new(None, None).unwrap();
    let mut deep = "0".to_owned();
    for _ in 0..80 {
        deep = format!("{{\"z\":1,\"a\":{deep}}}");
    }
    let real = std::fs::read_to_string("benches/data/jsonplaceholder-data.json").unwrap();
    for (name, input) in [("deep", deep), ("real-api", real)] {
        println!("dataset={name}, input_bytes={}", input.len());
        report(
            "whole_engine",
            sample(|| {
                black_box(engine::stringify(black_box(&input), limits).unwrap());
            }),
        );
        report(
            "serde_validation",
            sample(|| {
                black_box(
                    serde_json::from_str::<&serde_json::value::RawValue>(black_box(&input))
                        .unwrap(),
                );
            }),
        );
        let raw: &serde_json::value::RawValue = serde_json::from_str(&input).unwrap();
        report(
            "scan_sort_drop_tree",
            sample(|| {
                black_box(tree::parse(black_box(raw.get()), 128).unwrap());
            }),
        );
        let tree = tree::parse(raw.get(), 128).unwrap();
        report(
            "emit_prebuilt_tree",
            sample(|| {
                let mut output = String::with_capacity(input.len());
                engine::write(black_box(&tree), &mut output, limits).unwrap();
                black_box(output);
            }),
        );
    }
}
