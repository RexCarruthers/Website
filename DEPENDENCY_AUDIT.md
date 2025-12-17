# Dependency Audit Report
**Date**: 2025-12-17
**Auditor**: Claude Code
**Project**: Website (Quarto-based static site)

## Executive Summary

This audit identified **7 critical security vulnerabilities**, **23 outdated packages**, **1 missing dependency**, and approximately **4.5 MB of unnecessary bloat** in the project.

### Quick Stats
- **Project Type**: Quarto-based static website (v1.7.32)
- **Languages**: Python 3.11.14, HTML/CSS/JavaScript
- **Python Packages**: 59 installed
- **Site Size**: 21 MB (_site), 24 MB (.quarto cache)
- **Security Issues**: 7 vulnerabilities in 3 packages
- **Outdated Packages**: 23 packages with newer versions

---

## 1. Critical Security Vulnerabilities

Found **7 known vulnerabilities** in 3 packages that require immediate attention:

### cryptography 41.0.7 (4 vulnerabilities)
- **PYSEC-2024-225** - Fix available in 42.0.4+
- **CVE-2023-50782** - Fix available in 42.0.0+
- **CVE-2024-0727** - Fix available in 42.0.2+
- **GHSA-h4gh-qq45-vh27** - Fix available in 43.0.1+
- **Current**: 41.0.7
- **Recommended**: 46.0.3
- **Priority**: HIGH

### pip 24.0 (1 vulnerability)
- **CVE-2025-8869**
- **Current**: 24.0
- **Recommended**: 25.3
- **Priority**: HIGH

### setuptools 68.1.2 (2 vulnerabilities)
- **PYSEC-2025-49** - Fix available in 78.1.1+
- **CVE-2024-6345** - Fix available in 70.0.0+
- **Current**: 68.1.2
- **Recommended**: 80.9.0
- **Priority**: HIGH

---

## 2. Outdated Packages

23 packages have newer versions available:

### Critical Updates (Security-Related)
| Package | Current | Latest | Gap |
|---------|---------|--------|-----|
| cryptography | 41.0.7 | 46.0.3 | 5 major versions |
| pip | 24.0 | 25.3 | 1 major version |
| setuptools | 68.1.2 | 80.9.0 | 12 major versions |

### Major Updates (Functionality)
| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| httplib2 | 0.20.4 | 0.31.0 | Consider replacing with requests |
| launchpadlib | 1.11.0 | 2.1.0 | Likely unused |
| PyGObject | 3.48.2 | 3.54.5 | System package |
| PyJWT | 2.7.0 | 2.10.1 | Authentication library |
| wadllib | 1.3.6 | 2.0.0 | Likely unused |
| argcomplete | 3.1.4 | 3.6.3 | CLI completion |

### Minor Updates
- blinker: 1.7.0 → 1.9.0
- conan: 2.23.0 → 2.24.0
- dbus-python: 1.3.2 → 1.4.0
- oauthlib: 3.2.2 → 3.3.1
- packaging: 24.0 → 25.0
- patch-ng: 1.18.1 → 1.19.0
- pyparsing: 3.1.1 → 3.2.5
- PyYAML: 6.0.1 → 6.0.3
- six: 1.16.0 → 1.17.0
- urllib3: 2.6.1 → 2.6.2
- wheel: 0.42.0 → 0.45.1
- xmltodict: 0.13.0 → 1.0.2
- yq: 3.1.0 → 3.4.3

---

## 3. Missing Dependencies

### betfairlightweight (Not Installed)
- **Location**: Used in `Greyhound/jtc3.py:15-18`
- **Issue**: Script will fail if executed
- **Impact**: Greyhound data processing script is non-functional
- **Fix**: Add to requirements.txt and install

```python
# From Greyhound/jtc3.py
import betfairlightweight
from betfairlightweight.resources.bettingresources import (
    PriceSize,
    MarketBook
)
```

---

## 4. Unnecessary Bloat

### 4.1 Duplicate Bootstrap CSS Files (4.36 MB)

**Issue**: 10 Bootstrap CSS files consuming 4.36 MB of disk space

**Location**: `website/_site/site_libs/bootstrap/`

**Files**:
```
bootstrap-2220c541e9a114f679117361330e7ab1.min.css (487K)
bootstrap-2d66d6c836b8823bd7cc3c3c3e6570bd.min.css (487K)
bootstrap-5f20539691b2deff56cc66b24d2a488d.min.css (487K)
bootstrap-8499e120e5face98d183596a737b0efd.min.css (487K)
bootstrap-dark-1aaab0b8a84666a996f5730ef6421fe1.min.css (486K)
bootstrap-dark-9a79dd6601c0121da9af54492a79b066.min.css (486K)
bootstrap-dark-c5d527148f5317c1cad6905eeb739e81.min.css (486K)
bootstrap-dark-ef13dcf6113f26eaa77c69466be1ffc8.min.css (486K)
bootstrap-dfb324f25d9b1687192fa8be62ac8f9c.min.css (486K)
+ bootstrap-icons.css, bootstrap-icons.woff, bootstrap.min.js
```

**Cause**: Quarto generates new hashed CSS files on each build without cleaning up old versions

**Impact**:
- Wastes 4.3 MB of disk space
- Only 2-3 files actually needed (light theme, dark theme, icons)
- Remaining 7 files are duplicates/unused

**Fix**:
```bash
cd website
quarto clean
quarto render
```

### 4.2 Large Quarto Cache (.quarto/ - 24 MB)

**Issue**: Accumulated cache and temporary files

**Location**: `website/.quarto/`

**Contents**:
- Frozen site_libs
- Temporary session files
- Build artifacts

**Recommendation**:
- Add to `.gitignore` (if not already present)
- Periodically clean: `quarto clean`
- Safe to delete - will regenerate on next build

### 4.3 Unused Python Packages

Many system packages appear unused by this website project:

#### Definitely Unused (for this project)
- **conan** (2.23.0) - C++ package manager, not needed for Python/website project
- **dbus-python** (1.3.2) - System D-Bus bindings, not needed for static site
- **python-apt** (2.7.7) - Ubuntu package management, not needed

#### Likely Unused
- **httplib2** (0.20.4) - Redundant with `requests` library
- **launchpadlib** (1.11.0) - Launchpad integration tools
- **lazr.restfulclient** (0.14.6) - Launchpad dependency
- **lazr.uri** (1.0.6) - Launchpad dependency
- **wadllib** (1.3.6) - Launchpad dependency
- **yq** (3.1.0) - YAML/XML command-line processor
- **xmltodict** (0.13.0) - XML parsing (no XML files in project)

#### Verification Needed
- Check if any of these are required by system scripts
- Safe to remove if no dependencies found

**Estimated Space Savings**: Removing unused packages could save 50-100 MB

---

## 5. Recommendations

### Immediate Actions (Security - Do Today)

#### 1. Update vulnerable packages
```bash
pip3 install --upgrade cryptography pip setuptools
```

#### 2. Verify updates
```bash
pip-audit
```

Should return "No known vulnerabilities found"

### Short-term Actions (This Week)

#### 3. Create requirements.txt
```bash
cd /home/user/Website
cat > requirements.txt << 'EOF'
# Core dependencies for Greyhound betting analysis
betfairlightweight>=2.20.0

# Utility libraries
requests>=2.32.5
python-dateutil>=2.9.0

# Data processing (add as needed)
# pandas>=2.0.0
# numpy>=1.24.0
EOF
```

#### 4. Install missing dependencies
```bash
pip3 install -r requirements.txt
```

#### 5. Update other outdated packages
```bash
pip3 install --upgrade httplib2 PyJWT pyparsing urllib3 packaging wheel
```

#### 6. Clean Quarto build artifacts
```bash
cd website
quarto clean
rm -rf _site/
quarto render
```

#### 7. Check Quarto version
```bash
# Current: 1.7.32
# Check latest: https://quarto.org/docs/download/
# Update if new version available
```

### Long-term Actions (This Month)

#### 8. Audit and remove unused packages
```bash
# After verifying they're truly unused:
pip3 uninstall conan launchpadlib lazr.restfulclient lazr.uri yq xmltodict httplib2 dbus-python
```

#### 9. Improve .gitignore
```bash
cat >> .gitignore << 'EOF'
# Quarto
.quarto/
_site/
*.qmd.html

# Python
*.pyc
__pycache__/
*.py[cod]
*$py.class
.Python
env/
venv/

# IDEs
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
EOF
```

#### 10. Create development setup documentation
Create `DEVELOPMENT.md`:
```markdown
# Development Setup

## Requirements
- Python 3.11+
- Quarto 1.7.32+

## Installation
1. Install dependencies: `pip3 install -r requirements.txt`
2. Build website: `cd website && quarto render`

## Maintenance
- Update dependencies: `pip3 install --upgrade -r requirements.txt`
- Security audit: `pip-audit`
- Clean build: `quarto clean`
```

#### 11. Set up automated security scanning
- Add `pip-audit` to CI/CD pipeline
- Schedule monthly dependency updates
- Consider using Dependabot or similar service

#### 12. Optimize site assets
```bash
# Check image sizes
find website -name "*.png" -o -name "*.jpg" | xargs ls -lh

# profile.png is 74KB - consider optimizing if used frequently
```

---

## 6. Implementation Priority

### Priority 1: CRITICAL (Do Immediately)
- [ ] Update cryptography (security)
- [ ] Update pip (security)
- [ ] Update setuptools (security)
- [ ] Run pip-audit to verify

### Priority 2: HIGH (This Week)
- [ ] Create requirements.txt
- [ ] Install betfairlightweight
- [ ] Clean Quarto build artifacts
- [ ] Update other outdated packages

### Priority 3: MEDIUM (This Month)
- [ ] Remove unused Python packages
- [ ] Update .gitignore
- [ ] Create development documentation
- [ ] Check for Quarto updates

### Priority 4: LOW (As Needed)
- [ ] Set up automated security scanning
- [ ] Optimize images
- [ ] Consider virtual environment setup

---

## 7. Estimated Impact

### Security
- **Before**: 7 known vulnerabilities
- **After**: 0 known vulnerabilities
- **Risk Reduction**: 100%

### Disk Space
- **Before**: 21 MB (site) + 24 MB (cache) + 4.36 MB (duplicate CSS) = ~49 MB
- **After**: ~15 MB (site) + 10 MB (cache) = ~25 MB
- **Savings**: ~24 MB (49%)

### Maintenance
- **Before**: No dependency management, manual updates
- **After**: requirements.txt, documented process, security scanning
- **Improvement**: Reproducible builds, easier onboarding

---

## 8. Notes

### Quarto Dependencies
Quarto bundles these JavaScript libraries:
- Bootstrap 5.x (CSS framework)
- Fuse.js (search)
- Tippy.js (tooltips)
- Popper.js (positioning)
- Clipboard.js (copy functionality)
- Headroom.js (header behavior)
- Anchor.js (heading anchors)

These are managed by Quarto version, not separately.

### Python Standard Library Usage
The project uses these standard library modules (no installation needed):
- logging, typing, unittest.mock, itertools, functools
- os, tarfile, zipfile, bz2, glob

---

## 9. Questions for Project Owner

1. Is the `Greyhound/jtc3.py` script still actively used?
   - If yes: Install betfairlightweight
   - If no: Consider removing or documenting as legacy

2. Are the Launchpad packages (launchpadlib, lazr.*) needed?
   - These suggest Ubuntu PPA or bug tracking integration
   - Can likely be removed if not actively used

3. Is Conan (C++ package manager) intentionally installed?
   - Seems unrelated to a Python/website project
   - Safe to remove if not needed

4. Should we set up a virtual environment?
   - Recommended for project isolation
   - Current setup uses system Python

---

## 10. Conclusion

This audit found several areas for improvement:
- **Security**: 7 critical vulnerabilities requiring immediate patching
- **Maintenance**: 23 outdated packages should be updated
- **Optimization**: ~24 MB of unnecessary files can be cleaned
- **Missing**: 1 dependency needs installation
- **Unused**: ~10-15 packages can likely be removed

**Next Steps**: Follow the priority 1 and 2 recommendations above to secure the project and establish better dependency management practices.

**Estimated Time**:
- Priority 1 (Security): 15 minutes
- Priority 2 (Maintenance): 1 hour
- Priority 3 (Documentation): 2 hours

**Risk Level**: Currently MEDIUM due to unpatched security vulnerabilities. Will reduce to LOW after Priority 1 tasks complete.
