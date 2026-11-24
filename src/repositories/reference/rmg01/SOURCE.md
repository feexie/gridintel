# Source of these files

These files are the published files of:

Kemabonta, T., & Geoffrey, A. (2026). *A Multi-Year Daily Operations Dataset from a Rural
Solar Mini-Grid in Southern Nigeria* [Data set], version v1.0.2.
https://doi.org/10.5281/zenodo.24098636

- Repository: https://github.com/Kemabonta/rural-solar-minigrid-operations-dataset
- Version: tag `v1.0.2`, commit `bd9dea2fd23a3f641d9106390d1b98c8207bea4c` (the tags v1.0.0,
  v1.0.1 and v1.0.2 point at the same commit)
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0), in `LICENSE`
- Citation: `CITATION.cff`; the dataset's own description: `README.md`
- Retrieved: 2026-11-24, from `https://raw.githubusercontent.com/Kemabonta/rural-solar-minigrid-operations-dataset/<commit>/`
- Not taken: the `.xlsx` workbook, which holds the same tables as the CSVs.

The files are unchanged: not edited, not reformatted and not converted. `.gitattributes`
keeps git from changing their line endings. A unit test
(`src/repositories/reference/rmg01/source.test.ts`) recomputes the SHA-256 of every file
against the table below, so a changed file fails the check. A new version of the dataset
is taken by replacing the files and this table in a reviewed commit.

GridIntel's use: GridIntel calculates figures from the published data and shows them with
this citation and the licence; the data are unchanged.

| File | SHA-256 |
| --- | --- |
| `CITATION.cff` | `570286080d2a47b3aa657f3c36c766de2cf51d72d9b0359a94aaebe1944f73fb` |
| `LICENSE` | `9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411` |
| `README.md` | `e09d1ba8e986535b0c1007cffc300441054cf0f8ee803244a869326994c112b1` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_CAPEX.csv` | `f9b39f9a63d6c0b961250677283073927e169840004715312b1eb187ed308be6` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Caveats.csv` | `1182249419a5a6fdea845fcbe88e5dc27287858cf98c6249b56d125dfbef0d7a` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Coding_Convention.csv` | `7448070faf41c9771795c5730782e28b03c8d05ee8ce10df15895defbb2e6020` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Customers.csv` | `2fdb8b22ea58b57a5eb057bb20a64df86b50b2a8cf100e18e4d2c561772197af` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Data_Dictionary.csv` | `21bec3481b41dfb9cac7e562a4aa4e91863f3209bcac689ae6ca48df48f96412` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Equipment.csv` | `8ef49a8ed99ecdce97ee80cd42ca3a0b06bbde638e8315c5caa095ea50182b74` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Meter_Customer_Link.csv` | `82e8247a162c874fe512714ddb869c7587e2b12f1edf6961242ab7d8bb28d39c` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Meter_Daily.csv` | `8d7f7e4f63b09f1428203490e305687df8e0d59b161f1196c22f8ede648e6893` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Meter_Uptime.csv` | `dc8f67012593ed6b7eea0f2d60b6ade156c929ac6b2eb8c3fcce8d1e71e28372` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_OPEX.csv` | `3001a7db1a628a146fabfe62f9bfb6b79f7d6073c02d0136cbc069fae65a8d47` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Payments.csv` | `cd12d78a66c660465c34b84e8176efcc452bab2473090985e7f3b27f97ec24a2` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_README_Overview.csv` | `efd57e9f1318cd5889309806d47a5c4be5e50e0f1295ca77ccd109c80d394de5` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Reliability_Indices.csv` | `7a5fbbc6accb03855a9e9408639509ee59509aae1caf64cf9769a03c0d2fa831` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Reliability_Outages.csv` | `2161f5359df5058fb6b99d20cefa7ed92bf2fa6211b4cd2181b39e6213c19736` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Site_Daily.csv` | `024a6310d390a78f2eb36df5be6b2c58dbb25fdce4366443c4edfa5a7a20bea4` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Site_Description.csv` | `4dfd88427fe9a265a9398ab5276e2ad2328b4f2ee12e28db4b27608159036245` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Site_Monthly.csv` | `fd10e34782f9150d3e9ff29150b0abf0debd7dd37ba1c893c69a829bc81439e6` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Site_Yearly.csv` | `b5e92770eac861268054688457d921f1808aba471e2ac0517b15704de7e8b55c` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Tariffs.csv` | `9be57c2a5155f7a31c142ca98fc5bb99a1e1f0caf713d472c6f2aaeea7839eda` |
| `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_Tariffs_and_Events.csv` | `08b114604f44ef115c116ba3435ac2407113b131b110fea0fc393e83f6318cbd` |
