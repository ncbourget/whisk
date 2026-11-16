"""Shared product photography for both catalogs and the homepage."""
from html import escape as e

def live(item,field,html):
    """Mark a Square-sourced value so the Worker can show Square's current value without a rebuild.
    Kept in step with server/live.mjs. Unlinked items get no marker."""
    return f'<!--sq:{item["id"]}:{field}-->{html}<!--/sq-->' if item.get('squareVariationId') else html

def label(item):
    """Attribute marker for aria-labels that repeat the item name (comments cannot go in attributes)."""
    return f' data-sq-label="{e(item["id"])}"' if item.get('squareVariationId') else ''

def image_url(path,base):
    return path if path.startswith("https://") else base+"/"+path

def photos(item):
    return ([{'image':item['image'],'alt':item['imageAlt']}] if item['image'] else []) + item.get('photos',[])

def render_photo(item,base,detail=False):
    pictures=photos(item)
    if not pictures:return '<div class="food-space" aria-hidden="true"></div>'
    images=''.join(f'<img class="food-photo" src="{e(image_url(p["image"],base))}" alt="{e(p["alt"])}" width="800" height="600" loading="lazy"'+(' hidden' if n else '')+'>' for n,p in enumerate(pictures))
    if len(pictures)==1:return images
    thumbs=''.join(f'<button type="button" data-photo-index="{n}" aria-label="Show photo {n+1}: {e(p["alt"])}" aria-pressed="{str(n==0).lower()}"><img src="{e(image_url(p["image"],base))}" alt="" loading="lazy"></button>' for n,p in enumerate(pictures)) if detail else ''
    return '<div class="product-gallery" '+('data-product-gallery' if detail else 'data-card-slideshow')+'><div class="product-frames">'+images+'</div>'+('<div class="photo-deck">'+thumbs+'</div>' if detail else '')+'</div>'
