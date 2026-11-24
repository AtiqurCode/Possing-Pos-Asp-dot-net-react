namespace Possing.Services;

public class ProductImageService(IWebHostEnvironment env)
{
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif"
    };

    public string UploadsRoot => Path.Combine(env.ContentRootPath, "wwwroot", "uploads", "products");

    public async Task<string> SaveAsync(Guid productId, IFormFile file)
    {
        if (file.Length == 0)
            throw new InvalidOperationException("Empty file.");
        if (file.Length > 5 * 1024 * 1024)
            throw new InvalidOperationException("Image must be 5MB or smaller.");

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext) || !Allowed.Contains(ext))
            throw new InvalidOperationException("Allowed types: jpg, jpeg, png, webp, gif.");

        Directory.CreateDirectory(UploadsRoot);
        var fileName = $"{productId:N}{ext.ToLowerInvariant()}";
        var fullPath = Path.Combine(UploadsRoot, fileName);

        await using var stream = File.Create(fullPath);
        await file.CopyToAsync(stream);

        return $"/uploads/products/{fileName}";
    }

    public void DeleteIfExists(string? imagePath)
    {
        if (string.IsNullOrWhiteSpace(imagePath)) return;
        var name = Path.GetFileName(imagePath);
        if (string.IsNullOrWhiteSpace(name)) return;
        var full = Path.Combine(UploadsRoot, name);
        if (File.Exists(full))
            File.Delete(full);
    }
}
