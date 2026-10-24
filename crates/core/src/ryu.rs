//! Shortest round-trip digits of a double, ported from Ryu's `d2d`
//! (<https://github.com/ulfjack/ryu>, Copyright 2018 Ulf Adams, Boost Software
//! License 1.0; see NOTICE).
//!
//! Among the shortest digit strings that parse back to the double, Ryu returns the
//! one closest to its exact value, and the even one on a tie. That is the choice
//! ECMA-262 `Number::toString` makes, so the output matches V8 without a second
//! formatting pass.

use crate::ryu_tables::{POW5, POW5_INV};

const MANTISSA_BITS: u32 = 52;
const BIAS: i32 = 1023;
const POW5_BITS: i32 = 125;

/// `bitlen(5^e)` for `0 <= e <= 3528`.
fn pow5_bits(e: i32) -> i32 {
    ((e * 1_217_359) >> 19) + 1
}

/// `floor(log10(2^e))` for `0 <= e <= 1650`.
fn log10_pow2(e: i32) -> i32 {
    (e * 78_913) >> 18
}

/// `floor(log10(5^e))` for `0 <= e <= 2620`.
fn log10_pow5(e: i32) -> i32 {
    (e * 732_923) >> 20
}

fn multiple_of_pow5(mut value: u64, p: i32) -> bool {
    let mut count = 0;
    while value.is_multiple_of(5) {
        value /= 5;
        count += 1;
    }
    count >= p
}

fn multiple_of_pow2(value: u64, p: i32) -> bool {
    value.trailing_zeros().cast_signed() >= p
}

#[allow(
    clippy::cast_possible_truncation,
    reason = "the shift keeps the product below 2^64"
)]
fn mul_shift(m: u64, (low, high): (u64, u64), j: i32) -> u64 {
    let b0 = u128::from(m) * u128::from(low);
    let b2 = u128::from(m) * u128::from(high);
    (((b0 >> 64) + b2) >> (j - 64)) as u64
}

fn index(i: i32) -> usize {
    usize::try_from(i).unwrap_or(0)
}

/// Digits `d` and exponent `e` of finite, non-zero `v`, so that `|v|` prints as
/// `d * 10^e`. `d` can end in zeros when rounding carries.
#[allow(
    clippy::many_single_char_names,
    clippy::similar_names,
    clippy::too_many_lines,
    reason = "kept line for line with Ryu's d2d so the two can be compared"
)]
pub(crate) fn shortest(v: f64) -> (u64, i32) {
    let bits = v.to_bits();
    let ieee_mantissa = bits & ((1 << MANTISSA_BITS) - 1);
    let ieee_exponent = i32::try_from((bits >> MANTISSA_BITS) & 0x7ff).unwrap_or(0);
    let (e2, m2) = if ieee_exponent == 0 {
        (1 - BIAS - 52 - 2, ieee_mantissa)
    } else {
        (
            ieee_exponent - BIAS - 52 - 2,
            (1 << MANTISSA_BITS) | ieee_mantissa,
        )
    };
    // Round-half-even parsing maps both interval ends to v when its mantissa is even.
    let accept_bounds = m2 & 1 == 0;
    let mv = 4 * m2;
    // The interval is lopsided at a power of two: the next double down is closer.
    let mm_shift = u64::from(ieee_mantissa != 0 || ieee_exponent <= 1);
    let (mut vr, mut vp, mut vm);
    let e10;
    let mut vm_trailing_zeros = false;
    let mut vr_trailing_zeros = false;
    if e2 >= 0 {
        let q = log10_pow2(e2) - i32::from(e2 > 3);
        e10 = q;
        let k = POW5_BITS + pow5_bits(q) - 1;
        let i = -e2 + q + k;
        let mul = POW5_INV[index(q)];
        vr = mul_shift(4 * m2, mul, i);
        vp = mul_shift(4 * m2 + 2, mul, i);
        vm = mul_shift(4 * m2 - 1 - mm_shift, mul, i);
        if q <= 21 {
            // At most one of mp, mv and mm is a multiple of 5.
            if mv % 5 == 0 {
                vr_trailing_zeros = multiple_of_pow5(mv, q);
            } else if accept_bounds {
                vm_trailing_zeros = multiple_of_pow5(mv - 1 - mm_shift, q);
            } else {
                vp -= u64::from(multiple_of_pow5(mv + 2, q));
            }
        }
    } else {
        let q = log10_pow5(-e2) - i32::from(-e2 > 1);
        e10 = q + e2;
        let i = -e2 - q;
        let k = pow5_bits(i) - POW5_BITS;
        let j = q - k;
        let mul = POW5[index(i)];
        vr = mul_shift(4 * m2, mul, j);
        vp = mul_shift(4 * m2 + 2, mul, j);
        vm = mul_shift(4 * m2 - 1 - mm_shift, mul, j);
        if q <= 1 {
            // mv = 4 * m2 always has two trailing zero bits, mp = mv + 2 has one.
            vr_trailing_zeros = true;
            if accept_bounds {
                vm_trailing_zeros = mm_shift == 1;
            } else {
                vp -= 1;
            }
        } else if q < 63 {
            vr_trailing_zeros = multiple_of_pow2(mv, q);
        }
    }

    let mut removed = 0;
    let output = if vm_trailing_zeros || vr_trailing_zeros {
        // Rare (about 0.7%): track exact trailing zeros for the bound and the tie.
        let mut last_removed = 0;
        while vp / 10 > vm / 10 {
            vm_trailing_zeros &= vm % 10 == 0;
            vr_trailing_zeros &= last_removed == 0;
            last_removed = vr % 10;
            vr /= 10;
            vp /= 10;
            vm /= 10;
            removed += 1;
        }
        if vm_trailing_zeros {
            while vm % 10 == 0 {
                vr_trailing_zeros &= last_removed == 0;
                last_removed = vr % 10;
                vr /= 10;
                vm /= 10;
                removed += 1;
            }
        }
        if vr_trailing_zeros && last_removed == 5 && vr % 2 == 0 {
            last_removed = 4;
        }
        vr + u64::from((vr == vm && (!accept_bounds || !vm_trailing_zeros)) || last_removed >= 5)
    } else {
        let mut round_up = false;
        if vp / 100 > vm / 100 {
            round_up = vr % 100 >= 50;
            vr /= 100;
            vp /= 100;
            vm /= 100;
            removed += 2;
        }
        while vp / 10 > vm / 10 {
            round_up = vr % 10 >= 5;
            vr /= 10;
            vp /= 10;
            vm /= 10;
            removed += 1;
        }
        vr + u64::from(vr == vm || round_up)
    };
    (output, e10 + removed)
}
