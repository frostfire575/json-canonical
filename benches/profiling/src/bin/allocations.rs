//! Allocation counts only; timings from this instrumented binary are not used.
#[path = "../../../../src/engine.rs"]
#[allow(dead_code)]
mod engine;
#[path = "../../../../src/tree.rs"]
#[allow(dead_code)]
mod tree;
use stats_alloc::{INSTRUMENTED_SYSTEM, Region, Stats, StatsAlloc};
use std::{alloc::System, hint::black_box};

#[global_allocator]
static GLOBAL: &StatsAlloc<System> = &INSTRUMENTED_SYSTEM;

fn json(stats: Stats) -> serde_json::Value {
    serde_json::json!({
        "allocations": stats.allocations, "deallocations": stats.deallocations,
        "reallocations": stats.reallocations, "bytesAllocated": stats.bytes_allocated,
        "bytesDeallocated": stats.bytes_deallocated, "bytesReallocated": stats.bytes_reallocated,
    })
}
fn main() {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let limits = engine::Limits::new(None, None).unwrap();
    let mut report = Vec::new();
    for filename in arguments {
        let input = std::fs::read_to_string(&filename).unwrap();
        let repeated: Vec<String> = (0..32).map(|_| input.clone()).collect();
        let region = Region::new(GLOBAL);
        let output = engine::stringify(&input, limits).unwrap();
        black_box(&output);
        let single = region.change();
        drop(output);
        let region = Region::new(GLOBAL);
        let outputs: Result<Vec<String>, String> = repeated
            .iter()
            .map(|text| engine::stringify(text, limits))
            .collect();
        let outputs = outputs.unwrap();
        black_box(&outputs);
        let collected = region.change();
        drop(outputs);
        let region = Region::new(GLOBAL);
        let mut outputs = Vec::with_capacity(repeated.len());
        for input in &repeated {
            outputs.push(engine::stringify(input, limits).unwrap());
        }
        black_box(&outputs);
        let preallocated = region.change();
        drop(outputs);
        report.push(
            serde_json::json!({"inputFile": filename, "inputBytes": input.len(),
            "singleEngine": json(single), "batch32IteratorCollect": json(collected),
            "batch32Preallocated": json(preallocated)}),
        );
    }
    println!("{}", serde_json::to_string_pretty(&report).unwrap());
}
