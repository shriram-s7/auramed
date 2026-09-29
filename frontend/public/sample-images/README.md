# Sample Images

Reserved for real, licensed representative pathology/imaging examples, named
to match `src/config/referenceCases.js`:

- `breast/high_risk.jpg`, `breast/moderate.jpg`, `breast/benign.jpg`, `breast/normal.jpg`
- `cervical/hsil.jpg`, `cervical/lsil.jpg`, `cervical/ascus.jpg`, `cervical/normal.jpg`
- `pcos/pcos.jpg`, `pcos/normal.jpg`

No image files are checked in here — the reference cases displayed in the UI
are text/description cards until real, appropriately licensed clinical images
are added. If a file matching one of the names above is placed here, the
"Reference Images from Dataset" cards will display it automatically (the
`<img>` falls back to the description-only card on a 404).
