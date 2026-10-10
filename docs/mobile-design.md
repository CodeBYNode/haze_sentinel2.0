# Haze Sentinel mobile design

The supplied five screenshots guide the interaction and composition. The earlier Haze.png supplies the feature inventory. The latest earthy palette replaces the earlier blue proposal. Light mode is the only appearance.

## Visual decisions

- Ivory `#FAF7F0`: page background; linen `#FFFDF8`: elevated surfaces.
- Sand `#EDE3D2`: outlook and quieter information.
- Sage `#DDE5D7`: current conditions and botanical illustration.
- Olive `#526344`: actions and navigation.
- Terracotta `#A75237`: affected plans and emphasis.
- Espresso `#322E27`: primary text.
- Lora for editorial headings; DM Sans for interface text, with Georgia and system sans fallbacks.
- Left-aligned content, centered location/day headings, 20px mobile gutters, a maximum 480px reading width, and 48px primary controls.

```
Today                Schedule            Assistant
brand / actions      day / add           title / new chat
city / date          week selector       activity prompt icons
current API          AI planning strip   conversation
arrival / relief     grouped agenda      proposal review
affected plans       activity sheets     composer
pollution map
hourly outlook
---------------- four bottom tabs ----------------
```

The distinctive elements are the useful arrival/relief outlook, its transparent source sheet, and a botanical vector scene on onboarding. Data stays on untextured surfaces. Decoration is limited to the onboarding scene and a small leaf motif. The user explicitly requested the ivory/serif/terracotta combination; it is deliberate here. Weather-inspired cards use opaque warm surfaces rather than glass effects. Schedule uses day groups and action sheets, authentication uses focused full-width forms, and Assistant replaces decorative art with actionable icon prompts.

## Scope and data

This is a browser-local frontend prototype. Current readings, maps, timing, and proposed changes use labeled demo data. The source sheet links real background reporting with original publication dates, explicitly separates it from the fixture-based prediction, and does not claim those articles predict today's arrival or relief. Account methods remain replaceable; no real account or cloud AI is simulated. Optional health preferences stay in memory. Schedule changes require review and confirmation.

## References selected by the user

- Weather: https://mobbin.com/screens/ed9441b9-6ced-47ec-a9f3-8c98862a6888
- Tiimo editing flow: https://mobbin.com/flows/c4670a2d-bcbc-4e88-8e4c-7b8d1ff6e0a6
- Instacart: https://mobbin.com/screens/d3b5f79f-d324-46bf-8ce4-281ca7dc2f5a
- Headspace: https://mobbin.com/screens/7dba3826-1195-4066-a96d-a894870048ec
- Grok: supplied screenshot for the horizontal icon prompts and composer.
