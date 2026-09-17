> **Security update:** Open the local notebook through **Start Whisk.command**, which signs this browser into an eight-hour local session. A bookmarked `/editor/` URL alone cannot sign you in. If expired, restart the launcher. The hosted notebook is only available after Nate configures Cloudflare Access and adds your exact email; sign in with Cloudflare’s emailed code. Hosted editing remains download-only. A plain public-only deployment has no hosted editor. Never share launch links, codes, cookies, or downloaded confidential drafts.

# Cindy’s Whisk notebook

This website has a little notebook where you can change your menu and tell people where you’ll be. You do not need to edit the website’s layout or understand code.

For the first launch, sit down with Nate. You’ll need your real menu, photos, contact information, and Square setup. The preview currently contains **made-up sample products and prices**, and no one can buy them.

## Open your notebook

1. Open GitHub Desktop and choose the **whisk** repository.
2. Click **Fetch origin**, then **Pull origin** if offered. This brings in any changes Nate has made. Ask Nate if GitHub reports a conflict.
3. In Repository → Show in Finder, open the Whisk folder.
4. Double-click **Start Whisk.command**. Leave the small terminal window open. Nate can help with first-time Python or Mac permission setup.
5. The notebook opens in your browser. It says **Local notebook** at the top.
6. Choose **Bakery details**, **Menu items**, or **Upcoming stops**.

If you see **Download mode**, you opened a hosted copy instead. You can still edit and download files, but the local notebook is easier. See the alternate method below.

## Your everyday menu changes

Choose **Menu items**. Each bake has its own entry.

| To do this | Use this field or action |
| --- | --- |
| Add a baked good | Click **Add a baked good**, then fill in its name, category, description, and price. |
| Change a price | Enter the number in **Price**, such as `4.50`, without a dollar sign. Also change the price in Square. |
| Change a description | Edit **Description**. Short and specific works well. |
| Mark something sold out | Check **Sold out**. It remains visible, but its order link disappears. Update Square too. |
| Make it available again | Uncheck **Sold out**, and make sure **Show on the menu** is checked. Update Square too. |
| Temporarily remove an item | Uncheck **Show on the menu**. Its details are kept for later. |
| Permanently remove an entry from your draft | Click **Remove**, then confirm. Save when you are sure. Earlier saved versions are backed up. |
| Feature an item | Check **Feature on the homepage**. The first three featured, visible items appear. |
| Reorder items | Use **Move up** and **Move down**. This also controls the order of featured items. |
| Make a category | Type its name in **Category**. Spelling matters: “Cookies” and “cookies” are different categories. |
| Add dietary labels | Enter tags separated by commas. Only use claims you have checked for that recipe. |
| Add ingredient/allergen details | Fill in **Ingredients & allergens**. Review the general allergen note with Nate too. |
| Add seasonal or limited-run information | Check **Seasonal item**, or use **Extra notes / limited quantity message**. |
| Add storage/reheating advice | Use **Storage or reheating advice**. It appears under the item’s details. |

**The website menu and Square are separate.** Update both before telling customers an item is ready to order. Marking a bake sold out here does not disable a Square link someone saved yesterday.

## Photos

1. Find the item in **Menu items**.
2. Under **Photo file path**, choose a photo with the upload control.
3. Use a JPG, PNG, or WebP smaller than 5 MB. Aim for about **1200 × 1200 pixels and under 300 KB** for most menu photos. Nate can help resize large phone originals.
4. The notebook adds the photo to the right folder and fills in its file path.
5. In **Describe the photo**, write something useful, such as “Two cinnamon buns with vanilla icing on a white plate.” This helps customers who use a screen reader.
6. Choose Square, Portrait, or Landscape. The site fits the photo into that shape; you do not need a perfect crop. Keep the bake near the middle so it does not get cropped out.
7. Save and inspect the preview. To replace a photo, upload the new one. To remove a photo, clear the path and description. The site will show a neat “Fresh photo coming soon” space.

Natural window light, a simple background, and consistent framing help. Avoid screenshots, filters that change food colors, and huge originals. Include something for scale when useful. Real photographs should replace the temporary drawings before launch. Uploads do not automatically remove location metadata or resize pictures; Nate should strip metadata and compress final files.

## Change business status, hours, and contact details

Open **Bakery details**.

- Pick the **Business status**: Coming soon, Open today, Preorders open, Preorders closed, Sold out, Closed for the day, or Next pop-up.
- Use **Status note** for the useful detail: a date, what you are selling, or a change to today’s plans.
- Edit **Opening hours** and **Town or service area**. Because Whisk moves, keep the upcoming stop’s address current too.
- Edit **Contact email**, **Phone**, and the complete Instagram and Facebook profile links. Leave unknown fields blank. Empty social links are not shown as broken buttons.
- Use the story fields to put the introduction in your own words.

“Open today” is a note you control; it does not automatically follow a weekly calendar. Change it when the day ends. Optional ordering end dates stop website checkout links, but Square needs matching cutoffs too.

## Add or change a stop

1. Choose **Upcoming stops**, then **Add a stop**.
2. Enter the venue’s name and address.
3. Choose the start and end date/time. The notebook shows the business time zone. Nate should confirm the zone during setup.
4. Set the status to Confirmed, Tentative, or Cancelled. A cancelled event stays visibly cancelled until it passes, so customers can see the change.
5. Paste a directions link from a map service, if useful.
6. Add a short description or special menu note.
7. Save and preview **Find Whisk**.

Use **Remove** to delete an event from the draft. Past events are omitted when the site is rebuilt. A page already open in someone’s browser labels an event as ended when its end time passes. Publish a fresh update to remove old events for everyone, including customers with JavaScript disabled.

## Square links and ordering

1. Sign in to your own Square Dashboard.
2. Open **Payment links**. Create a link to **Sell an item**, select the correct item and price, then copy its public link.
3. Paste it into **This item’s Square link** in the notebook. A link often starts with `https://square.link/`.
4. For a whole basket, Nate can help set up your Square Online shop and put its URL in **Square shop / general ordering link**.
5. Check the pickup date, place, instructions, tax, quantity, and receipt in Square. An optional custom checkout field can ask for an order note; it does not reserve a pickup slot.
6. Nate should help enable ordering after test purchases and policy review. **Sample / demo mode** deliberately blocks every checkout link, even if a real link is entered.

Square takes payment and sends the customer confirmation. Whisk’s website never asks for payment card details. Never paste your Square password or access token into the notebook.

Square’s formal holiday-style **preorder** feature needs an eligible paid plan. A payment link by itself does not provide that feature or guarantee scheduled pickup. Ask Nate before changing plans.

## Preview, then publish

1. Click **Save & preview**. This saves all three tabs and checks for missing or invalid details. If you see an error, fix the named field and save again. Nothing is published yet.
2. Click **View website** at the top. If that tab was already open, refresh it.
3. Look at the homepage, menu, and Find Whisk page. Read prices carefully and check the intended items are visible.
4. Test the Square link and pickup details. Don’t make a real payment unless you intend to place a test order.
5. In GitHub Desktop, review **Changes**. Expect changed data, page files, and any new photos. If something unexpected appears, ask Nate.
6. Write a short summary such as “Friday menu and market location”. Click **Commit to main** (or the publishing branch Nate configured).
7. Click **Push origin**.
8. Once Nate has connected an eligible host with automatic publishing, wait for its successful deployment. GitHub’s check workflow alone does **not** publish the site.
9. Open the real website address and refresh. Check the update on your phone too.

Keep the notebook open until you have saved your work. Changes in its forms are not automatically saved. If two notebook windows disagree, it will ask you to download your draft and reload rather than overwrite someone else’s work.

## Alternate method: GitHub’s website

This is useful away from your regular computer, but the local notebook is easier.

1. Open the hosted notebook at your website’s `/editor/` address. It says Download mode.
2. Make your edits. For each tab you changed, click **Download this content file**. Save `site.json`, `menu.json`, and/or `events.json` as needed. These downloads are drafts, not publication.
3. For a new photo, open the GitHub repository, go to `assets/food`, choose **Add file → Upload files**, choose your photo, and commit. Give files simple names such as `lemon-cake.jpg`.
4. In the notebook, enter the path `assets/food/lemon-cake.jpg`, add its description, and download the menu file.
5. In GitHub, open the repository’s `data` folder. Choose **Add file → Upload files** and upload the downloaded files with their exact original filenames to replace them. Do not upload a browser-renamed file such as `menu (1).json`.
6. Add a short change description, then commit. A connected host will check and rebuild the site. If a check fails, contact Nate; the previous deployed version remains the one customers see.
7. To preview before replacing live content, ask Nate to set up a branch preview. Do not commit to the publishing branch expecting a private preview.

Avoid editing JSON directly using GitHub’s pencil unless Nate is helping; a missing comma can stop publication. The notebook avoids most formatting mistakes.

## If something goes wrong

- **Save failed:** Read the message. Missing photo descriptions, wrong links, and reversed event times are common causes. Your previous saved data is kept.
- **Checkout failed:** Ask the customer to check for a Square receipt before trying again. Use Square’s dashboard to check whether payment happened.
- **Wrong change published:** Contact Nate. GitHub keeps earlier versions; local notebook saves also have backups.
- **Photo missing:** Check its path or upload it again. The menu still shows the item’s text.
- **No stops listed:** That’s okay. Customers see a coming-soon message.

## Things you should contact Nate for

Page redesigns, logo/fonts/colors, integration changes, major layouts, new functionality, hosting accounts, domain/DNS/HTTPS, a new time zone or currency, checkout problems, undoing a published mistake, new catering or newsletter systems, or anything involving credentials. Contact Nate before removing demo mode for the first time.

## Refined website appearance

The notebook uses the same navy and blue palette as the website, with readable form controls. Editing and publishing work as before. The plain Whisk logo and food drawings are temporary. Send final logo files to Nate; changing the bakery-name field updates text and accessibility labels but does not redraw the logo artwork.
