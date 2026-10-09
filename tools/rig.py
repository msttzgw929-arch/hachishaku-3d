import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg=await b.new_page(viewport={'width':900,'height':900}); pg.set_default_timeout(240000)
        pg.on('pageerror',lambda e: print('ERR',e,flush=True))
        await pg.goto('http://localhost:8765/index.html', wait_until='commit')
        await pg.wait_for_function('!document.querySelector("#startBtn").disabled')
        await pg.evaluate('document.querySelector("#title").style.display="none"; __game.G.mode="test"; __game.G.testVel={x:0,y:0,z:1.6}; __game.hachi.root.position.set(0,0,-4)')
        shots=[('full','[0,2.8,7.5]','[0,2.6,-4]'),('legs','[2.6,0.9,-1.0]','[0,0.6,-4]'),('legs2','[0.3,1.0,-0.6]','[0,0.6,-4]')]
        for name,cp,lp in shots:
            await pg.evaluate(f'__game.G.fixedDt=1/30; __game.cam({cp},{lp})')
            for i in range(3):
                await pg.evaluate('__game.step(4)')
                await pg.screenshot(path=f'/tmp/rig_{name}_{i}.png')
            print(name,flush=True)
        await b.close()
asyncio.run(main())
