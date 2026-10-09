import asyncio, sys, json
from playwright.async_api import async_playwright
URL='http://localhost:8765/index.html'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        vw=json.loads(sys.argv[1]) if len(sys.argv)>1 else {'width':1280,'height':720}
        pref=sys.argv[2] if len(sys.argv)>2 else 'pc'
        ctx=await b.new_context(viewport=vw, has_touch=pref.startswith('sp'), is_mobile=pref.startswith('sp'), device_scale_factor=1)
        pg=await ctx.new_page(); pg.set_default_timeout(240000)
        logs=[]
        pg.on('console',lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
        pg.on('pageerror',lambda e: logs.append(f'PAGEERROR {e}'))
        pg.on('response',lambda r: logs.append(f'HTTP {r.status} {r.url}') if r.status>=400 else None)
        await pg.goto(URL, wait_until='commit'); await pg.wait_for_function('!document.querySelector("#startBtn").disabled')
        await pg.evaluate('__game.G.fixedDt=1/30'); await pg.evaluate('__game.step(20)')
        await pg.screenshot(path=f'screenshots/{pref}_1_title.png'); print('title',flush=True)
        await pg.click('#startBtn'); await pg.wait_for_function('__game.G.mode=="play"')
        await pg.evaluate('__game.place(0,6,4,-6); __game.step(10)')
        await pg.keyboard.down('KeyD'); await pg.evaluate('__game.step(25)'); await pg.keyboard.up('KeyD')
        await pg.evaluate('__game.step(3)')
        await pg.screenshot(path=f'screenshots/{pref}_2_chase.png'); print('chase',flush=True)
        await pg.evaluate('__game.G.invuln=0; __game.grab(); __game.step(45)')
        await pg.screenshot(path=f'screenshots/{pref}_3_grab.png'); print('grab',flush=True)
        await pg.mouse.click(vw['width']*0.5, vw['height']*0.55); await pg.evaluate('__game.step(2)')
        await pg.mouse.click(vw['width']*0.42, vw['height']*0.62); await pg.evaluate('__game.step(3)')
        await pg.screenshot(path=f'screenshots/{pref}_4_slap.png'); print('slap',flush=True)
        await pg.evaluate('__game.slap(12); __game.step(20)')
        # giant stage smashing through a block (side camera)
        await pg.evaluate('__game.setStage(5); __game.place(-55,-37,-55,-84); __game.G.invuln=999; __game.G.irritation=0; __game.cam([-48,24,-34],[-55,7,-64]); __game.step(170)')
        await pg.screenshot(path=f'screenshots/{pref}_5_giant.png'); print('giant',flush=True)
        await pg.evaluate('__game.step(40)')
        await pg.screenshot(path=f'screenshots/{pref}_5b_giant.png')
        await pg.evaluate('__game.cam(null); __game.step(10)')
        await pg.evaluate('__game.setStage(10); __game.G.irritation=0; __game.place(40,30,40,-20); __game.step(120)')
        await pg.screenshot(path=f'screenshots/{pref}_6_huge.png'); print('huge',flush=True)
        await pg.evaluate('__game.G.invuln=0; __game.G.hearts=1; __game.grab(); __game.step(60)')
        await pg.screenshot(path=f'screenshots/{pref}_7_final.png')
        await pg.evaluate('__game.step(120)'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=f'screenshots/{pref}_8_over.png'); print('over',flush=True)
        print('destroyed', await pg.evaluate('__game.G.destroyed'))
        print('\n'.join(logs)[:3000])
        await b.close()
asyncio.run(main())
