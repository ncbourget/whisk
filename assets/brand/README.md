# Approved Whisk identity handoff

These are neutral temporary slots, not recreations of Cindy's daughter's artwork. No brand screenshot or source files accompanied this pass. Do not treat the placeholder letterforms, proportions, or blue as approved identity.

| Asset | Replacement location | Current usage |
| --- | --- | --- |
| Primary wordmark | `assets/brand/whisk-wordmark.svg` | Header, editor, trailer |
| Reversed wordmark | `assets/brand/whisk-wordmark-reversed.svg` | Navy footer |
| Abbreviated mark | `assets/brand/whisk-mark.svg` | Prepared slot; copy approved small-size version to `assets/icons/favicon.svg` |
| Badge / alternate logo | `assets/brand/whisk-badge.svg` | Reserved; not displayed |
| Social image | Approved 1200 × 630 JPG, PNG, or WebP in this directory | Set `socialImage` and `socialImageAlt` in the notebook after adding the file |

Provide SVG exports plus AI/PDF masters, logo clear-space/minimum-size rules, approved RGB/HEX colors, and font names/files with web licenses. Keep editable masters outside the public asset directory; this directory ships with the site. Export text as paths for final logo SVGs, preserve a tight viewBox and transparent background, and omit embedded scripts/external resources. Artwork is separate from website text; never add a script UI font to mimic the logo.

Replace the named files, preserving paths. Adjust `.brand img`, `.trailer-wordmark`, and footer logo sizing in `assets/css/site.css` to honor the final aspect ratio/clear space; do not stretch artwork. Update SVG titles where useful. Existing linked-logo accessible names come from site data. Review header, trailer, footer, and editor at phone/tablet/desktop sizes after replacing.

Brand colors, font declarations, the three roles, and type scale are centralized in `assets/css/brand.css`. Public compositions live in `site.css`; notebook overrides live in `editor.css`. The trailer and standalone SVG assets have their own intrinsic fills; update those alongside the central palette. The current provisional palette is paper `#f8f7f2`, navy `#20283f`, blue `#b7c4e8`, silver `#c8cdd3`, and white. Blue is an environment, not low-contrast body text.

Font files and OFL licenses live in `assets/fonts/`. Change font declarations and role tokens together, keep exactly serif/sans/mono text roles, rebuild, and recheck wrapping. No paid font hosting is required.

Actual trailer photos should guide later geometry/material corrections. Licensed individual kitchen illustrations can replace the existing temporary whisk when the source and usage rights arrive. Do not tile the packaging sheet as a background.
