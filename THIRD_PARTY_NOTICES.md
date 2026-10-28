# Third-party notices

Prota integrates Pi, Copyright (c) 2025 Mario Zechner, under the MIT License.
Pi is an upstream project, not original Prota code. The initial source baseline is
`v1.4.0` (`4a080252f06caf63a525d7873c5d94d3c23887e0`) from
https://github.com/earendil-works/pi. `pi-version.json` records the current pin.

The unmodified upstream license is distributed at `runtime/pi/LICENSE.pi` and in
the source submodule at `vendor/pi/LICENSE`. Pi's packaged dependencies retain
their own license files under `runtime/pi/node_modules/`. Prota's integration is
implemented in its Gateway and Extension without changing Pi core source.
