import { describe, expect, test } from 'vitest';
import { allocatePayment, formatPEN, getFridays, progressPercent } from './treasury';
const base = { firstFriday:'2026-11-06', joinedFriday:'2026-11-06', weeklyFeeCents:500, throughFriday:'2026-12-25', paidByWeek:{}, pausedFridays:[] };
describe('motor base de tesorería', () => {
  test('calendario de viernes', () => expect(getFridays('2026-11-06','2026-11-20')).toEqual(['2026-11-06','2026-11-13','2026-11-20']));
  test('apertura 94 sobre meta 2000 equivale a 4.7%', () => expect(progressPercent(9400,200000)).toBe(4.7));
  test('meta no configurada', () => expect(progressPercent(9400,null)).toBeNull());
  test('un pago de 10 cubre 2 semanas si elige la segunda', () => {
    expect(allocatePayment({...base,amountCents:1000,paidAtDate:'2026-11-06',futureWeekSelections:['2026-11-13']})).toEqual([
      {kind:'week',weekId:'2026-11-06',amountCents:500},
      {kind:'week',weekId:'2026-11-13',amountCents:500}
    ]);
  });
  test('pago anticipado de 15 el 02/11 cubre tres semanas',()=>{
    expect(allocatePayment({...base,amountCents:1500,paidAtDate:'2026-11-02',futureWeekSelections:['2026-11-06','2026-11-13','2026-11-20']})).toHaveLength(3);
  });
  test('deuda antigua primero',()=>{
    const got=allocatePayment({...base,amountCents:500,paidAtDate:'2026-11-20',futureWeekSelections:[]});
    expect(got[0]).toEqual({kind:'week',weekId:'2026-11-06',amountCents:500});
  });
  test('excedente de 3 exige decisión',()=>{
    expect(()=>allocatePayment({...base,amountCents:800,paidAtDate:'2026-11-06',futureWeekSelections:[]})).toThrow('excedente');
    expect(allocatePayment({...base,amountCents:800,paidAtDate:'2026-11-06',futureWeekSelections:[],leftoverDestination:'credit'})).toEqual([
      {kind:'week',weekId:'2026-11-06',amountCents:500},{kind:'credit',amountCents:300}
    ]);
  });
  test('no paga cuota cubierta dos veces',()=>{
    expect(allocatePayment({...base,amountCents:500,paidAtDate:'2026-11-13',paidByWeek:{'2026-11-06':500},futureWeekSelections:[]})).toEqual([{kind:'week',weekId:'2026-11-13',amountCents:500}]);
  });
  test('valor inferior a 5 se rechaza',()=>expect(()=>allocatePayment({...base,amountCents:400,paidAtDate:'2026-11-06',futureWeekSelections:[]})).toThrow());
  test('formato local',()=>expect(formatPEN(9400)).toContain('94'));
});
