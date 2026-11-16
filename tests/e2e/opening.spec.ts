import {test,expect} from '@playwright/test';
test.beforeEach(async ({page}) => { await page.addInitScript(() => {sessionStorage.setItem('may.guest','1');sessionStorage.setItem('may.qa.seed','4271');}); });

test('day 2 with 40 portions of each tea and no pearls opens only after buying pearls',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('/');await page.getByRole('button',{name:'Nhập nguyên liệu',exact:true}).click();
 for(const name of ['Trà sữa','Hồng trà','Sữa','Đường','Đá','Ly M','Nắp']){
  const row=page.locator('.inventory article').filter({has:page.getByText(name,{exact:true})});
  await row.getByRole('button').click();
  if(name==='Trà sữa'||name==='Hồng trà')await row.getByRole('button').click();
 }
 await page.getByRole('button',{name:'Đóng cửa sổ'}).click();
 await page.getByRole('button',{name:'Nghỉ hôm nay & kết sổ',exact:true}).click();
 await page.getByRole('button',{name:'Sang ngày 2',exact:true}).click();
 await expect(page.locator('.tea').filter({hasText:'Trà sữa'})).toContainText('40 phần');
 await expect(page.locator('.topping').filter({hasText:'Trân châu'})).toContainText('0 phần');
 const before=await page.locator('.wallet b').innerText();
 await page.getByRole('button',{name:'Mở cửa tiệm',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'kho'})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('Trân châu');
 await expect(page.locator('.wallet b')).toHaveText(before);
 await page.locator('.inventory article').filter({has:page.getByText('Trân châu',{exact:true})}).getByRole('button').click();
 await page.getByRole('button',{name:'Đóng cửa sổ'}).click();
 await page.getByRole('button',{name:'Mở cửa tiệm',exact:true}).click();
 await expect(page.locator('.closed-card')).toHaveCount(0);
 await expect(page.locator('.order-heading')).toBeVisible();
 await page.screenshot({path:'screenshots/day2-opening-after-pearl-restock.png',fullPage:true});
 expect(errors).toEqual([]);
});
