# Math (`ShaderNodeMath`)

Scalar float math. In Geometry Nodes it is a pure field function: every input may be a single value
or a field, and the output is a single value when all used inputs are single, a field otherwise.
The formula below is applied independently to every element. All arithmetic is IEEE-754 single
precision (float32) unless a row says otherwise.

## Sockets

| Direction | Identifier | Type | Default | Notes |
|---|---|---|---|---|
| in | `Value` | float | 0.5 | first operand; called **A** below |
| in | `Value_001` | float | 0.5 | second operand; **B** |
| in | `Value_002` | float | 0.5 | third operand; **C** |
| out | `Value` | float | | result |

- All three inputs default to **0.5** on a node created from Python (`nodes.new`). The UI link-drag
  search sets friendlier defaults (e.g. B = 1 for Multiply), but that is an editor convenience, not
  node behaviour; a reference case must set every input it relies on.
- The unlinked value of each input is limited to [-10000, 10000] by the socket's range; a linked value
  is not clamped.
- Which inputs are **available** depends on the operation (table below). An unavailable input is
  ignored even if it has a value or a link.

## Properties

| Property | Values | Default |
|---|---|---|
| `operation` | 41 items, table below | `ADD` |
| `use_clamp` | bool | false |

`use_clamp`: after the operation, the result is clamped to [0, 1]: a result below 0 becomes 0, above
1 becomes 1. A NaN result stays NaN (both comparisons are false). Applies to every operation.

## Notation and helper definitions

- `floor`, `ceil`, `fabs`, `fmod`, `sin`, ... are the C `float` library functions (`floorf`, ...).
- `fract(x) = x - floor(x)` (so `fract(-0.25) = 0.75`).
- `safe_div(a, b) = (b != 0) ? a / b : 0`.
- `min2(a, b)`: returns `b` if `b < a`, else `a`. `max2(a, b)`: returns `b` if `a < b`, else `a`.
  With a NaN operand both return **the first operand** (`min2(NaN, 1) = NaN`, `min2(1, NaN) = 1`).
- `FLT_EPSILON = 1.1920929e-07` (2^-23).

## Operations

Inputs column: which of A, B, C are available. Labels are what the editor shows on the sockets.

| Identifier | Inputs (labels) | Result |
|---|---|---|
| `ADD` | A, B | `A + B` |
| `SUBTRACT` | A, B | `A - B` |
| `MULTIPLY` | A, B | `A * B` |
| `DIVIDE` | A, B | `safe_div(A, B)`: **0 when B == 0** (also for `0/0`, `inf/0`, `NaN/0`) |
| `MULTIPLY_ADD` | A (Value), B (Multiplier), C (Addend) | `A * B + C` |
| `POWER` | A (Base), B (Exponent) | see "Power" |
| `LOGARITHM` | A (Value), B (Base) | 0 if `A <= 0` or `B <= 0`; otherwise `safe_div(log(A), log(B))` (so base 1 gives 0). `log` is the natural logarithm; NaN inputs fail both `<= 0` tests and propagate |
| `SQRT` | A | `sqrt(A > 0 ? A : 0)`: negatives give 0; **NaN gives 0** (the guard replaces anything not `> 0` by 0) |
| `INVERSE_SQRT` | A | `A > 0 ? 1 / sqrt(A) : 0`; NaN gives 0 |
| `ABSOLUTE` | A | `fabs(A)` |
| `EXPONENT` | A | `exp(A)` (overflows to +inf above ~88.72) |
| `MINIMUM` | A, B | `min2(A, B)` |
| `MAXIMUM` | A, B | `max2(A, B)` |
| `LESS_THAN` | A, B (Threshold) | `1.0` if `A < B` else `0.0` (NaN gives 0) |
| `GREATER_THAN` | A, B (Threshold) | `1.0` if `A > B` else `0.0` (NaN gives 0) |
| `SIGN` | A | `1` if `A > 0`, `-1` if `A < 0`, else `0` (so `sign(-0) = 0`, `sign(NaN) = 0`) |
| `COMPARE` | A, B, C (Epsilon) | `1.0` if `A == B` or `fabs(A - B) <= max(C, FLT_EPSILON)`, else `0.0`. The epsilon never drops below FLT_EPSILON (negative or NaN C behaves as FLT_EPSILON). `inf` compared with `inf` gives 1 (exact equality). |
| `SMOOTH_MIN` | A, B, C (Distance) | see "Smooth min / max" |
| `SMOOTH_MAX` | A, B, C (Distance) | see "Smooth min / max" |
| `ROUND` | A | `floor(A + 0.5)` evaluated in float32. Halves round up: `-0.5 -> 0`, `-1.5 -> -1`, `2.5 -> 3`. Because the addition is float32, `0.49999997 + 0.5` rounds to `1.0` and the result is **1** |
| `FLOOR` | A | `floor(A)` |
| `CEIL` | A | `ceil(A)` (`ceil(-0.5)` is a zero; its sign is not pinned by the captured output) |
| `TRUNC` | A | `A >= 0 ? floor(A) : ceil(A)` |
| `FRACT` | A | `A - floor(A)`, always in [0, 1) for finite A |
| `MODULO` | A, B | truncated modulo: `B != 0 ? fmod(A, B) : 0`. Sign follows A: `fmod(-5.5, 2) = -1.5`, `fmod(5, -3) = 2` |
| `FLOORED_MODULO` | A, B | `B != 0 ? A - floor(A / B) * B : 0`. Sign follows B: `(-5.5, 2) -> 0.5`, `(5, -3) -> -1` |
| `WRAP` | A (Value), B (Max), C (Min) | `range = B - C`; `range != 0 ? A - range * floor((A - C) / range) : C`. Note **B is Max and C is Min**. With Max < Min the range is negative and the formula still applies |
| `SNAP` | A, B (Increment) | `floor(safe_div(A, B)) * B`; B = 0 gives 0 (`floor(0) * 0`). Negative values snap towards -inf: `(-7.3, 2) -> -8` |
| `PINGPONG` | A, B (Scale) | `B == 0 ? 0 : fabs(fract((A - B) / (2 * B)) * 2 * B - B)` |
| `SINE` | A | `sin(A)` |
| `COSINE` | A | `cos(A)` |
| `TANGENT` | A | `tan(A)` |
| `ARCSINE` | A | `asin(clamp(A, -1, 1))`: out-of-range input is clamped first (`asin(2) = pi/2`); NaN stays NaN |
| `ARCCOSINE` | A | `acos(clamp(A, -1, 1))` (`acos(-2) = pi`) |
| `ARCTANGENT` | A | `atan(A)` |
| `ARCTAN2` | A, B | `atan2(y = A, x = B)`: **A is the y argument** |
| `SINH` | A | `sinh(A)` |
| `COSH` | A | `cosh(A)` |
| `TANH` | A | `tanh(A)` |
| `RADIANS` | A (Degrees) | `float(double(A) * (pi / 180))`: the product is formed in **double** precision and rounded once to float |
| `DEGREES` | A (Radians) | `float(double(A) * (180 / pi))`, also in double |

### Power

Result `pow(A, B)` with one guard: if `A < 0` and B is not an integer (B differs from B truncated
to an integer), the result is **0** (`pow(-8, 1/3) = 0`, `pow(-2, 0.5) = 0`). A negative base with
an integer exponent is fine (`pow(-2, 3) = -8`). `pow(0, negative)` is +inf; `pow(0, 0) = 1`.

When the exponent is a single value equal to 0, 1, 2 or 3, Blender takes shortcuts: 0 gives exactly
1 for every base (including NaN and inf), 1 returns the base unchanged, 2 gives `A * A`, 3 gives
`A * A * A`. These agree with `pow` except for NaN/inf bases, so an implementation that uses `pow`
everywhere differs only there.

### Division shortcuts

When B is a single value: B == 0 gives 0 for every element (even when A is NaN or inf), B == 1
returns A unchanged. When A is a single value equal to 0, the result is 0 for every element **even
where B is NaN** (general IEEE division would give NaN for `0 / NaN`). These are the only observable
differences from `safe_div` applied element by element.

### Smooth min / max

With distance `k = C`:

- `SMOOTH_MIN(A, B, k)`: if `k != 0`: `h = max(k - |A - B|, 0) / k`; result
  `min(A, B) - h * h * h * k / 6` (the constant is `1/6` in float32, multiplied last). If `k == 0`:
  `min(A, B)`. Here `min`/`max` choose the second operand when the comparison fails, i.e.
  `min(a, b) = a < b ? a : b`.
- `SMOOTH_MAX(A, B, k) = -SMOOTH_MIN(-A, -B, k)`: **the distance is not negated**.
- A negative `k` makes `k - |A - B|` negative, so `h = 0` and the result is the plain min / max.

Example: `SMOOTH_MIN(1, 1.5, 1)`: `h = 0.5`, result `1 - 0.125 / 6 = 0.97916669`.
`SMOOTH_MAX(1, 1.5, 1) = 1.5208334`.

## Edge cases summary

- No operation raises; division by zero, log of non-positive, sqrt of negative and non-integer power
  of a negative base all give 0.
- NaN can only enter through inputs or be produced by `inf - inf`, `0 * inf`, `fmod(inf, x)`,
  `sin(inf)`, and similar. `SQRT`, `INVERSE_SQRT` and `SIGN` turn NaN into 0; `LESS_THAN`,
  `GREATER_THAN` give 0; `COMPARE` gives 0 (NaN is never equal, and the epsilon test fails).
- `MULTIPLY_ADD` may be computed with or without a fused multiply-add depending on the compiler;
  treat the last bit as unspecified (compare with 1 ulp tolerance).
- Trigonometric and exponential functions follow the platform float32 libm; compare with a tolerance
  of a few ulp.

## Reference cases

Every case stores the Math result as the float point attribute `r` on a one-point point cloud
(Points -> Store Named Attribute). Expected values are the analyst's prediction; the captured Blender
value is authoritative.

| id | op | A | B | C | clamp | expected |
|---|---|---|---|---|---|---|
| math-defaults | ADD | 0.5 | 0.5 | 0.5 | no | 1.0 |
| math-divide-zero | DIVIDE | 1 | 0 | - | no | 0 |
| math-divide-zero-zero | DIVIDE | 0 | 0 | - | no | 0 |
| math-power-neg-frac | POWER | -8 | 0.33333334 | - | no | 0 |
| math-power-neg-int | POWER | -2 | 3 | - | no | -8 |
| math-power-exp-2-5 | POWER | 2 | 2.5 | - | no | 5.656854 |
| math-log-8-2 | LOGARITHM | 8 | 2 | - | no | 3 (1 ulp) |
| math-log-neg | LOGARITHM | -1 | 2 | - | no | 0 |
| math-log-base-1 | LOGARITHM | 5 | 1 | - | no | 0 |
| math-sqrt-neg | SQRT | -4 | - | - | no | 0 |
| math-invsqrt-zero | INVERSE_SQRT | 0 | - | - | no | 0 |
| math-invsqrt-4 | INVERSE_SQRT | 4 | - | - | no | 0.5 |
| math-sign-zero | SIGN | 0 | - | - | no | 0 |
| math-sign-neg | SIGN | -0.5 | - | - | no | -1 |
| math-compare-eps | COMPARE | 1 | 1.05 | 0.1 | no | 1 |
| math-compare-floor-eps | COMPARE | 1 | 1.0000001 | 0 | no | 1 |
| math-compare-neg-eps | COMPARE | 1 | 1.1 | -1 | no | 0 |
| math-smoothmin | SMOOTH_MIN | 1 | 1.5 | 1 | no | 0.97916669 |
| math-smoothmax | SMOOTH_MAX | 1 | 1.5 | 1 | no | 1.5208334 |
| math-smoothmin-negk | SMOOTH_MIN | 1 | 1.5 | -1 | no | 1 |
| math-smoothmin-zero-k | SMOOTH_MIN | 1 | 1.5 | 0 | no | 1 |
| math-round-neg-half | ROUND | -0.5 | - | - | no | 0 |
| math-round-neg-1-5 | ROUND | -1.5 | - | - | no | -1 |
| math-round-2-5 | ROUND | 2.5 | - | - | no | 3 |
| math-round-float-edge | ROUND | 0.49999997 | - | - | no | 1 |
| math-ceil-neg | CEIL | -0.5 | - | - | no | 0 (the C library gives -0.0; the capture shows 0.0, so do not assert the sign of zero) |
| math-trunc-neg | TRUNC | -1.7 | - | - | no | -1 |
| math-fract-neg | FRACT | -0.25 | - | - | no | 0.75 |
| math-mod-trunc | MODULO | -5.5 | 2 | - | no | -1.5 |
| math-mod-floored | FLOORED_MODULO | -5.5 | 2 | - | no | 0.5 |
| math-mod-trunc-negb | MODULO | 5 | -3 | - | no | 2 |
| math-mod-floored-negb | FLOORED_MODULO | 5 | -3 | - | no | -1 |
| math-mod-zero | MODULO | 5 | 0 | - | no | 0 |
| math-mod-floored-zero | FLOORED_MODULO | 5 | 0 | - | no | 0 |
| math-wrap | WRAP | 5.5 | 2 | 0 | no | 1.5 |
| math-wrap-neg | WRAP | -0.5 | 1 | 0 | no | 0.5 |
| math-wrap-empty-range | WRAP | 7 | 3 | 3 | no | 3 |
| math-wrap-swapped | WRAP | 0.25 | 0 | 1 | no | 0.25 |
| math-snap | SNAP | 7.3 | 2 | - | no | 6 |
| math-snap-neg | SNAP | -7.3 | 2 | - | no | -8 |
| math-snap-zero | SNAP | 7.3 | 0 | - | no | 0 |
| math-pingpong-3 | PINGPONG | 3 | 2 | - | no | 1 |
| math-pingpong-4-5 | PINGPONG | 4.5 | 2 | - | no | 0.5 |
| math-pingpong-neg | PINGPONG | -1 | 2 | - | no | 1 |
| math-pingpong-zero | PINGPONG | 3 | 0 | - | no | 0 |
| math-asin-clamped | ARCSINE | 2 | - | - | no | 1.5707964 |
| math-acos-clamped | ARCCOSINE | -2 | - | - | no | 3.1415927 |
| math-atan2-order | ARCTAN2 | 1 | 0 | - | no | 1.5707964 |
| math-atan2-pi | ARCTAN2 | 0 | -1 | - | no | 3.1415927 |
| math-radians | RADIANS | 180 | - | - | no | 3.1415927 |
| math-degrees | DEGREES | 3.1415927 | - | - | no | 180.0 |
| math-muladd | MULTIPLY_ADD | 2 | 3 | 4 | no | 10 |
| math-clamp-low | SUBTRACT | 0.2 | 0.7 | - | yes | 0 |
| math-clamp-high | ADD | 0.7 | 0.7 | - | yes | 1 |
| math-min-max | MINIMUM | -1 | 2 | - | no | -1 |
| math-less | LESS_THAN | 1 | 1 | - | no | 0 |
| math-greater | GREATER_THAN | 2 | 1 | - | no | 1 |

NaN probes build NaN inside the tree as `inf = EXPONENT(100)`, `nan = SUBTRACT(inf, inf)` and feed
`nan` to the operation under test. The exporter writes NaN as `null`.

| id | tree | expected |
|---|---|---|
| math-nan-sqrt | SQRT(nan) | 0 |
| math-nan-sign | SIGN(nan) | 0 |
| math-nan-min-first | MINIMUM(nan, 1) | NaN |
| math-nan-min-second | MINIMUM(1, nan) | 1 |
| math-nan-max-second | MAXIMUM(1, nan) | 1 |
| math-nan-clamp | ADD(nan, 0) with clamp | NaN |
| math-nan-compare | COMPARE(nan, nan, 1) | 0 |
| math-nan-divide-by-single-zero | DIVIDE(nan, 0) | 0 |
| math-nan-zero-over-nan | DIVIDE(0 single, nan) | 0 |

```json
[
  {
    "id": "math-defaults",
    "description": "Math ADD on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ADD", "use_clamp": false}, "inputs": {"Value": 0.5, "Value_001": 0.5, "Value_002": 0.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-divide-zero",
    "description": "Math DIVIDE on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "DIVIDE", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-divide-zero-zero",
    "description": "Math DIVIDE on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "DIVIDE", "use_clamp": false}, "inputs": {"Value": 0, "Value_001": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-power-neg-frac",
    "description": "Math POWER on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "POWER", "use_clamp": false}, "inputs": {"Value": -8, "Value_001": 0.33333334}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-power-neg-int",
    "description": "Math POWER on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "POWER", "use_clamp": false}, "inputs": {"Value": -2, "Value_001": 3}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-power-exp-2-5",
    "description": "Math POWER on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "POWER", "use_clamp": false}, "inputs": {"Value": 2, "Value_001": 2.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-log-8-2",
    "description": "Math LOGARITHM on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "LOGARITHM", "use_clamp": false}, "inputs": {"Value": 8, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-log-neg",
    "description": "Math LOGARITHM on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "LOGARITHM", "use_clamp": false}, "inputs": {"Value": -1, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-log-base-1",
    "description": "Math LOGARITHM on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "LOGARITHM", "use_clamp": false}, "inputs": {"Value": 5, "Value_001": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-sqrt-neg",
    "description": "Math SQRT on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SQRT", "use_clamp": false}, "inputs": {"Value": -4}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-invsqrt-zero",
    "description": "Math INVERSE_SQRT on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "INVERSE_SQRT", "use_clamp": false}, "inputs": {"Value": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-invsqrt-4",
    "description": "Math INVERSE_SQRT on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "INVERSE_SQRT", "use_clamp": false}, "inputs": {"Value": 4}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-sign-zero",
    "description": "Math SIGN on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SIGN", "use_clamp": false}, "inputs": {"Value": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-sign-neg",
    "description": "Math SIGN on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SIGN", "use_clamp": false}, "inputs": {"Value": -0.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-compare-eps",
    "description": "Math COMPARE on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "COMPARE", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 1.05, "Value_002": 0.1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-compare-floor-eps",
    "description": "Math COMPARE on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "COMPARE", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 1.0000001, "Value_002": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-compare-neg-eps",
    "description": "Math COMPARE on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "COMPARE", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 1.1, "Value_002": -1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-smoothmin",
    "description": "Math SMOOTH_MIN on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SMOOTH_MIN", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 1.5, "Value_002": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-smoothmax",
    "description": "Math SMOOTH_MAX on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SMOOTH_MAX", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 1.5, "Value_002": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-smoothmin-negk",
    "description": "Math SMOOTH_MIN on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SMOOTH_MIN", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 1.5, "Value_002": -1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-smoothmin-zero-k",
    "description": "Math SMOOTH_MIN on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SMOOTH_MIN", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 1.5, "Value_002": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-round-neg-half",
    "description": "Math ROUND on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ROUND", "use_clamp": false}, "inputs": {"Value": -0.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-round-neg-1-5",
    "description": "Math ROUND on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ROUND", "use_clamp": false}, "inputs": {"Value": -1.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-round-2-5",
    "description": "Math ROUND on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ROUND", "use_clamp": false}, "inputs": {"Value": 2.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-round-float-edge",
    "description": "Math ROUND on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ROUND", "use_clamp": false}, "inputs": {"Value": 0.49999997}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-ceil-neg",
    "description": "Math CEIL on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "CEIL", "use_clamp": false}, "inputs": {"Value": -0.5}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-trunc-neg",
    "description": "Math TRUNC on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "TRUNC", "use_clamp": false}, "inputs": {"Value": -1.7}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-fract-neg",
    "description": "Math FRACT on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "FRACT", "use_clamp": false}, "inputs": {"Value": -0.25}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-mod-trunc",
    "description": "Math MODULO on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MODULO", "use_clamp": false}, "inputs": {"Value": -5.5, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-mod-floored",
    "description": "Math FLOORED_MODULO on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "FLOORED_MODULO", "use_clamp": false}, "inputs": {"Value": -5.5, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-mod-trunc-negb",
    "description": "Math MODULO on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MODULO", "use_clamp": false}, "inputs": {"Value": 5, "Value_001": -3}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-mod-floored-negb",
    "description": "Math FLOORED_MODULO on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "FLOORED_MODULO", "use_clamp": false}, "inputs": {"Value": 5, "Value_001": -3}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-mod-zero",
    "description": "Math MODULO on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MODULO", "use_clamp": false}, "inputs": {"Value": 5, "Value_001": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-mod-floored-zero",
    "description": "Math FLOORED_MODULO on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "FLOORED_MODULO", "use_clamp": false}, "inputs": {"Value": 5, "Value_001": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-wrap",
    "description": "Math WRAP on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "WRAP", "use_clamp": false}, "inputs": {"Value": 5.5, "Value_001": 2, "Value_002": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-wrap-neg",
    "description": "Math WRAP on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "WRAP", "use_clamp": false}, "inputs": {"Value": -0.5, "Value_001": 1, "Value_002": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-wrap-empty-range",
    "description": "Math WRAP on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "WRAP", "use_clamp": false}, "inputs": {"Value": 7, "Value_001": 3, "Value_002": 3}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-wrap-swapped",
    "description": "Math WRAP on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "WRAP", "use_clamp": false}, "inputs": {"Value": 0.25, "Value_001": 0, "Value_002": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-snap",
    "description": "Math SNAP on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SNAP", "use_clamp": false}, "inputs": {"Value": 7.3, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-snap-neg",
    "description": "Math SNAP on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SNAP", "use_clamp": false}, "inputs": {"Value": -7.3, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-snap-zero",
    "description": "Math SNAP on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SNAP", "use_clamp": false}, "inputs": {"Value": 7.3, "Value_001": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-pingpong-3",
    "description": "Math PINGPONG on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "PINGPONG", "use_clamp": false}, "inputs": {"Value": 3, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-pingpong-4-5",
    "description": "Math PINGPONG on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "PINGPONG", "use_clamp": false}, "inputs": {"Value": 4.5, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-pingpong-neg",
    "description": "Math PINGPONG on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "PINGPONG", "use_clamp": false}, "inputs": {"Value": -1, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-pingpong-zero",
    "description": "Math PINGPONG on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "PINGPONG", "use_clamp": false}, "inputs": {"Value": 3, "Value_001": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-asin-clamped",
    "description": "Math ARCSINE on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ARCSINE", "use_clamp": false}, "inputs": {"Value": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-acos-clamped",
    "description": "Math ARCCOSINE on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ARCCOSINE", "use_clamp": false}, "inputs": {"Value": -2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-atan2-order",
    "description": "Math ARCTAN2 on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ARCTAN2", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-atan2-pi",
    "description": "Math ARCTAN2 on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ARCTAN2", "use_clamp": false}, "inputs": {"Value": 0, "Value_001": -1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-radians",
    "description": "Math RADIANS on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "RADIANS", "use_clamp": false}, "inputs": {"Value": 180}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-degrees",
    "description": "Math DEGREES on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "DEGREES", "use_clamp": false}, "inputs": {"Value": 3.1415927}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-muladd",
    "description": "Math MULTIPLY_ADD on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MULTIPLY_ADD", "use_clamp": false}, "inputs": {"Value": 2, "Value_001": 3, "Value_002": 4}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-clamp-low",
    "description": "Math SUBTRACT with clamp on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT", "use_clamp": true}, "inputs": {"Value": 0.2, "Value_001": 0.7}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-clamp-high",
    "description": "Math ADD with clamp on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ADD", "use_clamp": true}, "inputs": {"Value": 0.7, "Value_001": 0.7}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-min-max",
    "description": "Math MINIMUM on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MINIMUM", "use_clamp": false}, "inputs": {"Value": -1, "Value_001": 2}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-less",
    "description": "Math LESS_THAN on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "LESS_THAN", "use_clamp": false}, "inputs": {"Value": 1, "Value_001": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-greater",
    "description": "Math GREATER_THAN on constants, stored on one point",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "GREATER_THAN", "use_clamp": false}, "inputs": {"Value": 2, "Value_001": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-nan-sqrt",
    "description": "Math SQRT with a NaN operand built as exp(100) - exp(100)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SQRT", "use_clamp": false}, "inputs": {}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["m", "Value"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-nan-sign",
    "description": "Math SIGN with a NaN operand built as exp(100) - exp(100)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "SIGN", "use_clamp": false}, "inputs": {}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["m", "Value"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-nan-min-first",
    "description": "Math MINIMUM with a NaN operand built as exp(100) - exp(100)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MINIMUM", "use_clamp": false}, "inputs": {"Value_001": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["m", "Value"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-nan-min-second",
    "description": "Math MINIMUM with a NaN operand built as exp(100) - exp(100)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MINIMUM", "use_clamp": false}, "inputs": {"Value": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["m", "Value_001"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-nan-max-second",
    "description": "Math MAXIMUM with a NaN operand built as exp(100) - exp(100)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "MAXIMUM", "use_clamp": false}, "inputs": {"Value": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["m", "Value_001"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-nan-clamp",
    "description": "Math ADD with a NaN operand built as exp(100) - exp(100)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "ADD", "use_clamp": true}, "inputs": {"Value_001": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["m", "Value"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-nan-compare",
    "description": "Math COMPARE with a NaN operand built as exp(100) - exp(100)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "COMPARE", "use_clamp": false}, "inputs": {"Value_002": 1}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["m", "Value"]},
        {"from": ["nan", "Value"], "to": ["m", "Value_001"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-nan-divide-by-single-zero",
    "description": "Math DIVIDE with a NaN operand built as exp(100) - exp(100)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "DIVIDE", "use_clamp": false}, "inputs": {"Value_001": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["m", "Value"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  },
  {
    "id": "math-nan-zero-over-nan",
    "description": "Math DIVIDE with a NaN operand built as exp(100) - exp(100)",
    "tree": {
      "nodes": [
        {"name": "pts", "type": "GeometryNodePoints", "inputs": {"Count": 1}},
        {"name": "inf", "type": "ShaderNodeMath", "properties": {"operation": "EXPONENT"}, "inputs": {"Value": 100}},
        {"name": "nan", "type": "ShaderNodeMath", "properties": {"operation": "SUBTRACT"}},
        {"name": "m", "type": "ShaderNodeMath", "properties": {"operation": "DIVIDE", "use_clamp": false}, "inputs": {"Value": 0}},
        {"name": "store", "type": "GeometryNodeStoreNamedAttribute", "properties": {"data_type": "FLOAT", "domain": "POINT"}, "inputs": {"Name": "r"}}
      ],
      "links": [
        {"from": ["inf", "Value"], "to": ["nan", "Value"]},
        {"from": ["inf", "Value"], "to": ["nan", "Value_001"]},
        {"from": ["nan", "Value"], "to": ["m", "Value_001"]},
        {"from": ["pts", "Geometry"], "to": ["store", "Geometry"]},
        {"from": ["m", "Value"], "to": ["store", "Value"]}
      ],
      "output": ["store", "Geometry"]
    }
  }
]
```
