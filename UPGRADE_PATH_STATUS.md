# Upgrade Path Status Report

## ✅ PATH A: COMPLETE - Selective Safe Updates

**Completed successfully with 4 commits reducing vulnerabilities from 42 → 28 (33% reduction).**

### Commits:
1. `9869936` - build: update safe core dependencies for security
2. `d2768c7` - build: update glob matching and lodash dependencies
3. `77cebe5` - build: update YAML, CSS, and utility library security patches
4. `936d977` - build: update serialization and WebSocket security patches

### What Was Updated:
- **Core Utils**: ajv, json5 (proto pollution fixes)
- **Glob Tools**: minimatch, braces, picomatch, micromatch (ReDoS fixes)
- **YAML/CSS**: js-yaml, postcss, word-wrap, tough-cookie
- **Serialization**: flatted, form-data
- **Network**: ws (DoS fix)
- **Random**: nanoid

### Testing Results:
✅ All 39 tests pass
✅ Build succeeds
✅ No breaking changes

### Vulnerabilities Remaining (28):
- 1 Critical: @babel/traverse (code execution in @babel/core)
- 7 High: dts-cli, rollup, jest-related, serialize-javascript
- 3 Moderate: @babel packages
- 17 Low/Unspecified: various

---

## ⚠️ PATH B & C: BLOCKED - Requires dts-cli Upgrade Investigation

### The Problem:
The remaining 28 vulnerabilities require upgrading the build toolchain:
- **dts-cli 1.6.0** is old and causes critical Babel/Jest vulnerabilities
- **TypeScript 4.5.5** is from Dec 2021, incompatible with modern Jest/ts-jest
- **Jest 27** is unmaintained, incompatible with TypeScript 5

### Why They Block Each Other:
1. **TypeScript 5 + Jest 27** → Type checking failure ("ts-jest/dist not found")
2. **dts-cli 2.x + current code** → Rollup config breakage ("Entry module cannot be external")
3. **dts-cli 2.x + module resolution** → Cannot resolve internal modules from src/

### Attempted Solution PATH C:

**Attempt 1: TypeScript Upgrade Only**
- ❌ Failed: Jest 27 doesn't support TypeScript 5

**Attempt 2: dts-cli 2 Upgrade**
- ❌ Failed: Multiple issues
  - Old patch doesn't apply (compatibility issue)
  - New rollup config treats src/ files as external
  - Module resolution doesn't work even with dts.config.js modifications

### Why This is Complex:
dts-cli is a **monolithic build tool** that tightly couples:
- TypeScript version
- Jest version
- Rollup configuration
- Module resolution strategy

Upgrading dts-cli 1.6 → 2.x requires:
1. Understanding new rollup plugin architecture
2. Potentially rewriting dts.config.js
3. Possibly adjusting how external modules are handled
4. Full integration testing

Alternatively: **Consider switching build tool to something modern** like:
- esbuild
- tsup
- tsc directly

---

## 📋 Recommendations

### Short Term (Completed):
✅ **PATH A achieved** - 33% vulnerability reduction safely
- Good for maintaining project stability
- Can be merged immediately
- Provides meaningful security improvement

### Medium Term (Decision Needed):
Choose one:

**Option 1: Stay on dts-cli 1.6.0**
- ✅ Pros: Stable, proven, works
- ❌ Cons: 28 vulnerabilities remain (1 critical), slow tools
- Timeline: Can stay like this indefinitely

**Option 2: Deep Dive into dts-cli 2**
- ❌ Effort: 2-4 hours research + implementation
- ✅ Reward: Fix ~95% of vulnerabilities
- Risk: May need to adjust source code or build config significantly
- Requires expertise in rollup/build tools

**Option 3: Migrate to Modern Build Tool**
- Effort: 1-2 days (significant refactoring)
- Reward: Modern, well-maintained, likely better performance
- Options: tsup, esbuild, or direct tsc
- Risk: Changes to build process may affect output

### Long Term:
Recommend establishing a **dependency update policy**:
- Regular npm audit runs
- Update minor/patch versions frequently
- Major version upgrades on a schedule (quarterly?)
- Keep build tools current (especially dts-cli which is slow-moving)

---

## Files Changed
- package.json: ~25 dependencies updated (safe versions)
- package-lock.json: Updated to match

## Files NOT Changed
- dts.config.js: Attempted modification reverted (didn't help)
- src/: No source code changes
- patches/: No patch regeneration attempted (dts-cli 2 incompatibility)

---

## Next Steps
1. ✅ Merge PATH A (4 commits, security improvements)
2. ⏸️ Decide on Path B/C strategy
3. 📅 Plan future build tool modernization

