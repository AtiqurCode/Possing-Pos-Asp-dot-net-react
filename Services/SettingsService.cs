using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Possing.Data;
using Possing.Dtos;
using Possing.Models;
using Possing.Options;

namespace Possing.Services;

public class SettingsService(AppDbContext db, IOptions<StoreOptions> defaults)
{
    public async Task EnsureSeededAsync()
    {
        var d = defaults.Value;
        await UpsertIfMissingAsync(SettingKeys.StoreName, d.Name);
        await UpsertIfMissingAsync(SettingKeys.StoreAddress, d.Address);
        await UpsertIfMissingAsync(SettingKeys.StorePhone, d.Phone);
        await UpsertIfMissingAsync(SettingKeys.Currency, string.IsNullOrWhiteSpace(d.Currency) ? "BDT" : d.Currency);
        await UpsertIfMissingAsync(SettingKeys.VatPercent, d.VatPercent.ToString("0.##"));
        await UpsertIfMissingAsync(SettingKeys.TaxMode, string.IsNullOrWhiteSpace(d.TaxMode) ? TaxModes.Exclusive : d.TaxMode);
        await db.SaveChangesAsync();
    }

    public async Task<StoreSettingsDto> GetStoreAsync()
    {
        await EnsureSeededAsync();
        var map = await db.AppSettings.AsNoTracking().ToDictionaryAsync(x => x.Key, x => x.Value);
        return Map(map);
    }

    public async Task<StoreSettingsDto> UpdateStoreAsync(UpdateStoreSettingsRequest request)
    {
        if (request.VatPercent < 0 || request.VatPercent > 100)
            throw new InvalidOperationException("VAT percent must be between 0 and 100.");

        var taxMode = (request.TaxMode ?? TaxModes.Exclusive).Trim();
        if (taxMode is not (TaxModes.Exclusive or TaxModes.Inclusive))
            throw new InvalidOperationException("Tax mode must be Exclusive or Inclusive.");

        var currency = string.IsNullOrWhiteSpace(request.Currency) ? "BDT" : request.Currency.Trim().ToUpperInvariant();

        await SetAsync(SettingKeys.StoreName, request.Name?.Trim() ?? "Possing Store");
        await SetAsync(SettingKeys.StoreAddress, request.Address?.Trim() ?? string.Empty);
        await SetAsync(SettingKeys.StorePhone, request.Phone?.Trim() ?? string.Empty);
        await SetAsync(SettingKeys.Currency, currency);
        await SetAsync(SettingKeys.VatPercent, request.VatPercent.ToString("0.##"));
        await SetAsync(SettingKeys.TaxMode, taxMode);
        await db.SaveChangesAsync();

        return await GetStoreAsync();
    }

    private async Task UpsertIfMissingAsync(string key, string value)
    {
        if (await db.AppSettings.AnyAsync(x => x.Key == key))
            return;
        db.AppSettings.Add(new AppSetting { Key = key, Value = value });
    }

    private async Task SetAsync(string key, string value)
    {
        var row = await db.AppSettings.FirstOrDefaultAsync(x => x.Key == key);
        if (row is null)
        {
            db.AppSettings.Add(new AppSetting { Key = key, Value = value });
            return;
        }

        row.Value = value;
        row.UpdatedAt = DateTime.UtcNow;
    }

    private static StoreSettingsDto Map(IReadOnlyDictionary<string, string> map)
    {
        var vat = 0m;
        if (map.TryGetValue(SettingKeys.VatPercent, out var vatRaw))
            decimal.TryParse(vatRaw, out vat);

        var taxMode = map.GetValueOrDefault(SettingKeys.TaxMode, TaxModes.Exclusive);
        if (taxMode is not (TaxModes.Exclusive or TaxModes.Inclusive))
            taxMode = TaxModes.Exclusive;

        return new StoreSettingsDto(
            map.GetValueOrDefault(SettingKeys.StoreName, "Possing Store"),
            map.GetValueOrDefault(SettingKeys.StoreAddress, string.Empty),
            map.GetValueOrDefault(SettingKeys.StorePhone, string.Empty),
            vat,
            map.GetValueOrDefault(SettingKeys.Currency, "BDT"),
            taxMode);
    }
}
